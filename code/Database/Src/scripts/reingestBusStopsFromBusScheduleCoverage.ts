import { prisma } from "../infrastructure/orm/prisma/client";
import { env } from "../config/env";
import { AccessNodesClient } from "../infrastructure/apiClients/AccessNodesClient";
import { AccessNodeRepository } from "../infrastructure/repositories/AccessNodeRepository";
import { AccessNodesIngestionService } from "../services/AccessNodesIngestionService";

function parseArg(name: string): string | undefined {
  const arg = process.argv.find((x) => x.startsWith(`--${name}=`));
  return arg ? arg.split("=").slice(1).join("=") : undefined;
}

function parseIntArg(name: string, defaultValue: number): number {
  const raw = parseArg(name);
  if (raw === undefined) return defaultValue;

  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`Invalid integer for --${name}: ${raw}`);
  }
  return n;
}

function parseBooleanArg(name: string, defaultValue: boolean): boolean {
  const raw = parseArg(name);
  if (raw === undefined) return defaultValue;

  const v = raw.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  throw new Error(`Invalid boolean for --${name}: ${raw}`);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((x) => x.length > 0))).sort((a, b) => a.localeCompare(b));
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function getAtcoAreaCodesFromBusSchedule(): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ code: string | null }>>`
    SELECT DISTINCT LEFT("stopId", 3) AS code
    FROM "BusSchedule"
    WHERE "stopId" ~ '^[0-9]{3}'
    ORDER BY 1
  `;

  return uniqueStrings(
    rows
      .map((r) => String(r.code ?? "").trim())
      .filter((x) => /^\d{3}$/.test(x))
  );
}

function parseAtcoAreaCodesFromArg(raw: string): string[] {
  return uniqueStrings(
    raw
      .split(",")
      .map((x) => x.trim())
      .filter((x) => /^\d{3}$/.test(x))
  );
}

async function main() {
  const sourceIdBase = parseArg("sourceIdBase") ?? "naptan-access-nodes-coverage";
  const chunkSize = parseIntArg("chunkSize", 10);
  const maxCodesRaw = parseIntArg("maxCodes", 0);
  const maxCodes = maxCodesRaw > 0 ? maxCodesRaw : undefined;
  const dryRun = parseBooleanArg("dryRun", false);
  const atcoAreaCodesArg = parseArg("atcoAreaCodes");

  const areaCodes = atcoAreaCodesArg
    ? parseAtcoAreaCodesFromArg(atcoAreaCodesArg)
    : await getAtcoAreaCodesFromBusSchedule();

  if (areaCodes.length === 0) {
    throw new Error("No ATCO area codes found from BusSchedule.stopId coverage.");
  }

  const chosenCodes = maxCodes ? areaCodes.slice(0, maxCodes) : areaCodes;
  const chunks = chunkArray(chosenCodes, Math.max(1, chunkSize));

  console.log("[access-nodes-coverage] source from:", atcoAreaCodesArg ? "arg" : "BusSchedule.stopId");
  console.log("[access-nodes-coverage] total area codes:", areaCodes.length);
  console.log("[access-nodes-coverage] selected area codes:", chosenCodes.length);
  console.log("[access-nodes-coverage] area codes:", chosenCodes.join(","));
  console.log("[access-nodes-coverage] chunks:", chunks.length, "chunkSize:", Math.max(1, chunkSize));
  console.log("[access-nodes-coverage] dryRun:", dryRun);

  if (dryRun) return;

  const client = new AccessNodesClient(env.NAPTAN_API_BASE_URL);
  const repo = new AccessNodeRepository();
  const service = new AccessNodesIngestionService(client, repo);

  let totalUpserted = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const sourceId = `${sourceIdBase}:${chunk[0]}-${chunk[chunk.length - 1]}`;
    console.log(
      `[access-nodes-coverage] [${i + 1}/${chunks.length}] ingesting area codes: ${chunk.join(",")}`
    );

    const n = await service.ingestAccessNodes(sourceId, chunk);
    totalUpserted += n;

    console.log(
      `[access-nodes-coverage] [${i + 1}/${chunks.length}] done: recordsProcessed=${n}, sourceId=${sourceId}`
    );
  }

  console.log("[access-nodes-coverage] summary:", {
    chunks: chunks.length,
    areaCodes: chosenCodes.length,
    totalRecordsProcessed: totalUpserted,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

