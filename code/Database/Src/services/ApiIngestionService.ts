import { LocalitiesIngestionService } from "./LocalitiesIngestionService";
import { AccessNodesIngestionService } from "./AccessNodesIngestionService";
import { RailIngestionService } from "./RailIngestionService";

export type IngestionReport = {
  localities: { ok: boolean; count?: number; error?: string };
  accessNodes: { ok: boolean; count?: number; error?: string };
  rail: { ok: boolean; error?: string };
};

/**
 * Orchestrator over the concrete `*IngestionService` classes. Callers (cron
 * jobs, admin triggers) talk to this service instead of wiring every source
 * individually, which keeps ingestion a single Single-Responsibility seam.
 * Adding a new provider means implementing a new `*IngestionService` and
 * composing it here — no caller changes required (Open-Closed).
 */
export class ApiIngestionService {
  constructor(
    private readonly localities: LocalitiesIngestionService,
    private readonly accessNodes: AccessNodesIngestionService,
    private readonly rail: RailIngestionService
  ) {}

  async ingestLocalities(sourceId = "naptan-nptg"): Promise<number> {
    return this.localities.ingestLocalities(sourceId);
  }

  async ingestAccessNodes(atcoAreaCodes: string[] = ["250"]): Promise<number> {
    return this.accessNodes.ingestAccessNodes("naptan-access-nodes", atcoAreaCodes);
  }

  async ingestRail(): Promise<void> {
    await this.rail.ingestRailRoutes("rail_timetable");
  }

  /** Run every ingestion source once, capturing per-source success/failure. */
  async runAll(): Promise<IngestionReport> {
    const report: IngestionReport = {
      localities: { ok: false },
      accessNodes: { ok: false },
      rail: { ok: false },
    };

    try {
      const count = await this.ingestLocalities();
      report.localities = { ok: true, count };
    } catch (err) {
      report.localities = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }

    try {
      const count = await this.ingestAccessNodes();
      report.accessNodes = { ok: true, count };
    } catch (err) {
      report.accessNodes = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }

    try {
      await this.ingestRail();
      report.rail = { ok: true };
    } catch (err) {
      report.rail = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }

    return report;
  }
}
