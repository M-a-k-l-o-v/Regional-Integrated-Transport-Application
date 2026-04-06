import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function parseIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  const normalised = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalised)) return true;
  if (["0", "false", "no", "off"].includes(normalised)) return false;
  return fallback;
}

function parseCsvEnv(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  if (!raw) return fallback;
  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return values.length > 0 ? values : fallback;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: parseInt(process.env.PORT ?? "3000", 10),
  DATABASE_URL: requireEnv("DATABASE_URL"),
  REDIS_URL: process.env.REDIS_URL ?? null,
  NAPTAN_API_BASE_URL: requireEnv("NAPTAN_API_BASE_URL"),
  RAIL_TIMETABLE_PATH: requireEnv("RAIL_TIMETABLE_PATH"),
  TRANSPORT_SERVER_BASE_URL:
    process.env.TRANSPORT_SERVER_BASE_URL ?? "http://transport.scc.lancs.ac.uk",
  TRANSPORT_SERVER_TIMEOUT_MS: parseIntEnv("TRANSPORT_SERVER_TIMEOUT_MS", 15_000),
  NETWORK_RAIL_STOMP_ENABLED: parseBooleanEnv("NETWORK_RAIL_STOMP_ENABLED", false),
  NETWORK_RAIL_STOMP_HOST: process.env.NETWORK_RAIL_STOMP_HOST ?? "transport.scc.lancs.ac.uk",
  NETWORK_RAIL_STOMP_PORT: parseIntEnv("NETWORK_RAIL_STOMP_PORT", 61_618),
  NETWORK_RAIL_STOMP_USERNAME: process.env.NETWORK_RAIL_STOMP_USERNAME ?? "",
  NETWORK_RAIL_STOMP_PASSWORD: process.env.NETWORK_RAIL_STOMP_PASSWORD ?? "",
  NETWORK_RAIL_STOMP_TOPICS: parseCsvEnv("NETWORK_RAIL_STOMP_TOPICS", [
    "TRAIN_MVT_ALL_TOC",
    "TD_ALL_SIG_AREA",
    "VSTP_ALL",
  ]),
  NATIONAL_HIGHWAYS_API_KEY: process.env.NATIONAL_HIGHWAYS_API_KEY ?? null,
};
