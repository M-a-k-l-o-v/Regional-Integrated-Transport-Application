import { generateWorkNote } from "./generate-work-note.mjs";

const INTERVAL_MS = 30 * 60 * 1000;

function run() {
  try {
    const path = generateWorkNote(30);
    console.log(`[work-notes] wrote ${path}`);
  } catch (err) {
    console.error("[work-notes] failed to write note:", err);
  }
}

setInterval(run, INTERVAL_MS);
console.log("[work-notes] watcher running. First note in 30 minutes, then every 30 minutes.");
