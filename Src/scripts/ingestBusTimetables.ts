import path from "node:path";
import fs from "node:fs";
import { BusTimetableIngestionService } from "../services/BusTimetableIngestionService";

function parseArg(name: string): string | undefined {
  const a = process.argv.find(x => x.startsWith(`--${name}=`));
  return a ? a.split("=").slice(1).join("=") : undefined;
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
  const maxFiles = Number(parseArg("maxFiles") ?? "0") || undefined;

  const serviceDateStr = parseArg("serviceDate") ?? new Date().toISOString().slice(0, 10);
  const serviceDate = new Date(serviceDateStr);
  serviceDate.setHours(0, 0, 0, 0);

  const sourceId = "bods_txc";

  const svc = new BusTimetableIngestionService();

  const files = file ? [file] : dir ? listXmlFiles(dir) : [];
  if (files.length === 0) {
    throw new Error("Provide --file=... or --dir=...");
  }

  const chosen = maxFiles ? files.slice(0, maxFiles) : files;

  console.log("[bus] ingesting files:", chosen.length, "serviceDate:", serviceDateStr);

  for (const f of chosen) {
    await svc.ingestTransXChangeFile(sourceId, f, {
      serviceDate,
      keepContextStops: 2,
      lancashireOnly: true,
    });
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});