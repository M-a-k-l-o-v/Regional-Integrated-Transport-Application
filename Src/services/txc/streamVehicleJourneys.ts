import fs from "node:fs";
import { SaxesParser, SaxesTag } from "saxes";

export type VehicleJourneyChunkHandler = (vjXml: string) => Promise<void>;

function attrsToString(attrs: Record<string, any>) {
  // saxes provides attrs as { name: { value } } (sometimes) depending on config
  // We normalize by checking common shapes
  const parts: string[] = [];
  for (const [k, v] of Object.entries(attrs)) {
    const val =
      v && typeof v === "object" && "value" in v ? (v as any).value : (v as any);
    if (val === undefined || val === null) continue;
    const escaped = String(val)
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
    parts.push(`${k}="${escaped}"`);
  }
  return parts.length ? " " + parts.join(" ") : "";
}

/**
 * Streams a TXC file and calls `onVehicleJourney(vjXml)` for each <VehicleJourney>...</VehicleJourney>.
 * Memory stays low because we only buffer a single VehicleJourney subtree at a time.
 */
export async function streamVehicleJourneys(
  filePath: string,
  onVehicleJourney: VehicleJourneyChunkHandler
): Promise<void> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`TXC file not found: ${filePath}`);
  }

  const parser = new SaxesParser({ xmlns: false }); // keep tag names simple
  const rs = fs.createReadStream(filePath, { encoding: "utf8" });

  let inVJ = false;
  let vjDepth = 0;
  let buf = "";

  // Backpressure: pause file reading while DB is writing
  let pending: Promise<void> = Promise.resolve();
  const chain = (p: Promise<void>) => (pending = pending.then(() => p));

  parser.on("opentag", (tag: SaxesTag) => {
    const name = tag.name; // e.g. "VehicleJourney"
    if (name === "VehicleJourney") {
      inVJ = true;
      vjDepth = 1;
      buf = `<${name}${attrsToString(tag.attributes as any)}>`;
      return;
    }

    if (inVJ) {
      vjDepth++;
      buf += `<${name}${attrsToString(tag.attributes as any)}>`;
    }
  });

  parser.on("text", (t: string) => {
    if (!inVJ) return;
    // escape text
    buf += t
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  });

  parser.on("cdata", (t: string) => {
    if (!inVJ) return;
    buf += `<![CDATA[${t}]]>`;
  });

  parser.on("closetag", (name: string) => {
    if (!inVJ) return;

    buf += `</${name}>`;
    vjDepth--;

    if (name === "VehicleJourney" && vjDepth === 0) {
      const vjXml = buf;
      inVJ = false;
      buf = "";

      // Pause reading while we process this journey (prevents queue explosion)
      rs.pause();
      chain(
        (async () => {
          await onVehicleJourney(vjXml);
        })().finally(() => rs.resume())
      );
    }
  });

  parser.on("error", (e) => {
    rs.destroy(e as any);
  });

  await new Promise<void>((resolve, reject) => {
    rs.on("data", (chunk) => parser.write(chunk));
    rs.on("end", () => resolve());
    rs.on("error", reject);
  });

  parser.close();
  await pending; // wait for all inserts to finish
}