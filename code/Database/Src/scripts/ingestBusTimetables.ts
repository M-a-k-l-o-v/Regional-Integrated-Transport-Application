import path from "node:path";
import fs from "node:fs";
import { BusTimetableIngestionService } from "../services/BusTimetableIngestionService";

// NOTE: When calling this script, wrap --file=... or --dir=... values in quotes if they contain spaces.
// Example:
//   npx ts-node Src/scripts/ingestBusTimetables.ts --file="data/.../my file.xml" --serviceDate=2026-02-23
function parseArg(name: string): string | undefined {
  const a = process.argv.find(x => x.startsWith(`--${name}=`));
  return a ? a.split("=").slice(1).join("=") : undefined;
}

function parseArgs(name: string): string[] {
  return process.argv
    .filter((x) => x.startsWith(`--${name}=`))
    .map((x) => x.split("=").slice(1).join("="))
    .filter((x) => x.length > 0);
}

function parseBooleanArg(name: string, defaultValue: boolean): boolean {
  const value = parseArg(name);
  if (value === undefined) return defaultValue;

  const normalised = value.trim().toLowerCase();
  if (normalised === "true" || normalised === "1" || normalised === "yes") return true;
  if (normalised === "false" || normalised === "0" || normalised === "no") return false;

  throw new Error(`Invalid boolean for --${name}: ${value}`);
}

function parseIntArg(name: string, defaultValue: number): number {
  const raw = parseArg(name);
  if (raw === undefined) return defaultValue;

  const v = Number(raw);
  if (!Number.isInteger(v) || v < 0) {
    throw new Error(`Invalid integer for --${name}: ${raw}`);
  }
  return v;
}

type ScopeMode = "strict" | "corridor" | "strict_corridor" | "all";

function parseScopeModeArg(name: string): ScopeMode | undefined {
  const raw = parseArg(name);
  if (raw === undefined) return undefined;

  const v = raw.trim().toLowerCase();
  if (v === "strict" || v === "corridor" || v === "all") return v;
  if (v === "strict+corridor" || v === "strict_corridor" || v === "hybrid") return "strict_corridor";

  throw new Error(
    `Invalid value for --${name}: ${raw}. Expected strict|corridor|strict+corridor|all`
  );
}

function listXmlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listXmlFiles(p));
    else if (entry.isFile() && p.toLowerCase().endsWith(".xml")) out.push(p);
  }
  return out;
}

async function main() {
  const file = parseArg("file");
  const dir = parseArg("dir");
  const dirArgs = parseArgs("dir");
  const dirsCsv = parseArg("dirs");
  const maxFiles = Number(parseArg("maxFiles") ?? "0") || undefined;
  const lancashireOnly = parseBooleanArg("lancashireOnly", true);
  const continueOnError = parseBooleanArg("continueOnError", true);
  const edgeStops = parseIntArg("edgeStops", parseIntArg("keepContextStops", 2));
  const corridorAnchor = (parseArg("corridorAnchor") ?? "lancaster").trim();
  const scopeModeArg = parseScopeModeArg("scopeMode");
  const scopeMode: ScopeMode = scopeModeArg ?? (lancashireOnly ? "strict" : "all");

  const serviceDateStr = parseArg("serviceDate") ?? new Date().toISOString().slice(0, 10);
  const serviceDate = new Date(serviceDateStr);
  serviceDate.setHours(0, 0, 0, 0);

  const sourceId = "bods_txc";

  const svc = new BusTimetableIngestionService();

  const dirList = [
    ...dirArgs,
    ...(dir ? [dir] : []),
    ...(dirsCsv ? dirsCsv.split(",").map((x) => x.trim()).filter(Boolean) : []),
  ];

  const files = file
    ? [file]
    : dirList.length > 0
      ? dirList.flatMap((d) => listXmlFiles(d))
      : [];

  if (files.length === 0) {
    throw new Error("Provide --file=..., --dir=... (repeatable), or --dirs=dir1,dir2");
  }

  // deterministic run order
  const uniqueFiles = Array.from(new Set(files)).sort((a, b) => a.localeCompare(b));
  const chosen = maxFiles ? uniqueFiles.slice(0, maxFiles) : uniqueFiles;

  let ok = 0;
  let failed = 0;
  const failedFiles: Array<{ file: string; error: string }> = [];

  console.log(
    "[bus] ingesting files:",
    chosen.length,
    "serviceDate:",
    serviceDateStr,
    "scopeMode:",
    scopeMode,
    "edgeStops:",
    edgeStops,
    "corridorAnchor:",
    corridorAnchor,
    "legacyLancashireOnly:",
    lancashireOnly,
    "continueOnError:",
    continueOnError
  );

  for (let i = 0; i < chosen.length; i++) {
    const f = chosen[i];
    const progress = `[bus] [${i + 1}/${chosen.length}]`;

    try {
      console.log(`${progress} ingesting: ${f}`);
      await svc.ingestTransXChangeFile(sourceId, f, {
        serviceDate,
        keepContextStops: edgeStops,
        lancashireOnly,
        scopeMode,
        corridorAnchor,
      });
      ok++;
      console.log(`${progress} success`);
    } catch (e: any) {
      failed++;
      const msg = String(e?.message ?? e);
      failedFiles.push({ file: f, error: msg });
      console.error(`${progress} failed: ${f}`);
      console.error(msg);

      if (!continueOnError) {
        throw e;
      }
    }
  }

  console.log("[bus] ingestion summary:", {
    total: chosen.length,
    successfulFiles: ok,
    failedFiles: failed,
  });

  if (failedFiles.length > 0) {
    console.log("[bus] failed files:");
    for (const row of failedFiles) {
      console.log(`- ${row.file}`);
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
