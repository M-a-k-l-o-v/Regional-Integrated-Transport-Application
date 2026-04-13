import type { Client, ConnectFailover } from "stompit";
import stompit from "stompit";
import type { LiveMovementEntry } from "../../infrastructure/liveData/LiveMovementStore";

export type RailLiveTopicKey = "TRAIN_MVT_ALL_TOC" | "TD_ALL_SIG_AREA" | "VSTP_ALL";

export type MovementHandler = (entry: Omit<LiveMovementEntry, "receivedAtMs">) => void;

type RailLiveTopicStatus = {
  topic: RailLiveTopicKey;
  destination: string;
  subscribed: boolean;
  messageCount: number;
  lastMessageAt: string | null;
  lastSampleSummary: string | null;
  lastError: string | null;
};

export type RailLiveStreamStatus = {
  enabled: boolean;
  started: boolean;
  connected: boolean;
  host: string;
  port: number;
  lastConnectedAt: string | null;
  lastError: string | null;
  topics: RailLiveTopicStatus[];
};

export type RailLiveStreamOptions = {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  password: string;
  topics: RailLiveTopicKey[];
  onMovement?: MovementHandler;
};

function createTopicStatus(topic: RailLiveTopicKey): RailLiveTopicStatus {
  return {
    topic,
    destination: `/topic/${topic}`,
    subscribed: false,
    messageCount: 0,
    lastMessageAt: null,
    lastSampleSummary: null,
    lastError: null,
  };
}

function summariseMessage(topic: RailLiveTopicKey, body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return `${topic}: empty payload`;

  try {
    const parsed = JSON.parse(trimmed);
    if (topic === "TRAIN_MVT_ALL_TOC") {
      const movement = Array.isArray(parsed) ? parsed[0] : parsed;
      const bodyRecord = movement?.body ?? movement;
      return `movement ${bodyRecord?.train_id ?? bodyRecord?.trainId ?? "unknown"}`;
    }
    if (topic === "TD_ALL_SIG_AREA") {
      const message = Array.isArray(parsed) ? parsed[0] : parsed;
      const keys = typeof message === "object" && message ? Object.keys(message).slice(0, 3).join(",") : typeof message;
      return `td message ${keys || "unknown"}`;
    }
    if (topic === "VSTP_ALL") {
      const schedule = Array.isArray(parsed) ? parsed[0] : parsed;
      const bodyRecord = schedule?.schedule ?? schedule;
      return `vstp ${bodyRecord?.CIF_train_uid ?? bodyRecord?.trainUid ?? "unknown"}`;
    }
  } catch {
    return `${topic}: ${trimmed.slice(0, 80)}`;
  }

  return `${topic}: payload received`;
}

export class RailLiveStreamService {
  private client: Client | null = null;
  private failover: ConnectFailover | null = null;
  private started = false;
  private connected = false;
  private lastConnectedAt: string | null = null;
  private lastError: string | null = null;
  private readonly topics: Map<RailLiveTopicKey, RailLiveTopicStatus>;

  constructor(private readonly options: RailLiveStreamOptions) {
    this.topics = new Map(options.topics.map((topic) => [topic, createTopicStatus(topic)]));
  }

  start() {
    if (!this.options.enabled || this.started) return;
    this.started = true;

    const serverConfig: any = {
      host: this.options.host,
      port: this.options.port,
      connectHeaders: {
        host: "/",
        login: this.options.username,
        passcode: this.options.password,
        "heart-beat": "5000,5000",
      },
      reconnectOptions: {
        initialReconnectDelay: 2000,
        maxReconnectDelay: 30000,
        useExponentialBackOff: true,
      },
    };
    this.failover = new stompit.ConnectFailover([serverConfig]);

    this.failover.connect((error, client, reconnect) => {
      if (error) {
        this.connected = false;
        this.lastError = error.message;
        reconnect();
        return;
      }

      this.client = client;
      this.connected = true;
      this.lastConnectedAt = new Date().toISOString();
      this.lastError = null;

      client.on("error", (clientError: Error) => {
        this.connected = false;
        this.lastError = clientError.message;
      });

      for (const topic of this.options.topics) {
        this.subscribe(topic, client);
      }
    });
  }

  stop() {
    this.client?.disconnect();
    this.client = null;
    this.connected = false;
  }

  getStatus(): RailLiveStreamStatus {
    return {
      enabled: this.options.enabled,
      started: this.started,
      connected: this.connected,
      host: this.options.host,
      port: this.options.port,
      lastConnectedAt: this.lastConnectedAt,
      lastError: this.lastError,
      topics: Array.from(this.topics.values()),
    };
  }

  private subscribe(topic: RailLiveTopicKey, client: Client) {
    const destination = `/topic/${topic}`;
    client.subscribe({ destination, ack: "auto" }, (error: Error | null, message: any) => {
      const topicStatus = this.topics.get(topic);
      if (!topicStatus) return;

      if (error) {
        topicStatus.lastError = error.message;
        topicStatus.subscribed = false;
        return;
      }

      topicStatus.subscribed = true;
      message.readString("utf-8", (readError: Error | null, body: string) => {
        if (readError) {
          topicStatus.lastError = readError.message;
          return;
        }

        topicStatus.messageCount += 1;
        topicStatus.lastMessageAt = new Date().toISOString();
        topicStatus.lastSampleSummary = summariseMessage(topic, body);
        topicStatus.lastError = null;

        if (topic === "TRAIN_MVT_ALL_TOC" && this.options.onMovement) {
          this.parseAndEmitMovements(body, this.options.onMovement);
        }
      });
    });
  }

  private parseAndEmitMovements(body: string, handler: MovementHandler): void {
    let messages: unknown[];
    try {
      const parsed = JSON.parse(body.trim());
      messages = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return;
    }

    for (const msg of messages) {
      if (typeof msg !== "object" || msg === null) continue;
      const m = msg as Record<string, unknown>;
      const msgBody = (m.body ?? m) as Record<string, unknown>;

      const eventType = typeof msgBody.event_type === "string" ? msgBody.event_type : null;
      const stanox = typeof msgBody.loc_stanox === "string" ? msgBody.loc_stanox.trim() : null;
      const trainId = typeof msgBody.train_id === "string" ? msgBody.train_id.trim() : null;

      if (!eventType || !stanox || !trainId) continue;

      const rawActual = msgBody.actual_timestamp;
      const actualTimestampMs =
        typeof rawActual === "string" && rawActual.trim().length > 0
          ? parseInt(rawActual.trim(), 10) || null
          : typeof rawActual === "number"
            ? rawActual
            : null;

      const rawVariation = msgBody.timetable_variation;
      const timetableVariationMinutes =
        typeof rawVariation === "string" && rawVariation.trim().length > 0
          ? parseInt(rawVariation.trim(), 10) || null
          : null;

      const variationStatus =
        typeof msgBody.variation_status === "string" ? msgBody.variation_status : null;

      const platform =
        typeof msgBody.platform === "string" && msgBody.platform.trim().length > 0
          ? msgBody.platform.trim()
          : null;

      handler({
        trainId,
        eventType,
        stanox,
        actualTimestampMs,
        timetableVariationMinutes,
        variationStatus,
        platform,
      });
    }
  }
}
