import fs from "node:fs";
import readline from "node:readline";

export type RailTimetableReadOptions = {
  /** If provided, stop after emitting this many non-empty lines. */
  maxLines?: number;
  startLine?: number;
};

export class RailTimetableClient {
  // NOTE: This is now a FILE PATH (e.g. /.../rail_timetable_index.ndjson), not a base URL.
  constructor(private readonly filePath: string) {}

  /**
   * Streams the timetable NDJSON file as lines.
   * Designed for very large files (multi-GB) without loading into memory.
   */
  async *fetchDailyTimetableLines(options: RailTimetableReadOptions = {}): AsyncGenerator<string> {
    if (!this.filePath) {
      throw new Error("RAIL_TIMETABLE_PATH is not set");
    }
    if (!fs.existsSync(this.filePath)) {
      throw new Error(`Rail timetable file not found at: ${this.filePath}`);
    }

    const stream = fs.createReadStream(this.filePath, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    let seen = 0;
    let emitted = 0;

    try {
      for await (const line of rl) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        seen++;

        /*
         * CHANGE: startLine handling
         * - Use an explicit undefined check so startLine=0 behaves correctly.
         * - Semantics: if startLine = N, lines 1..N are skipped and emission begins at N+1.
         */
        if (options.startLine !== undefined && seen <= options.startLine) {
          continue;
        }

        yield trimmed;
        emitted++;

        if (options.maxLines && emitted >= options.maxLines) {
          break;
        }
      }
    } finally {
      rl.close();
      stream.destroy();
    }
  }
}