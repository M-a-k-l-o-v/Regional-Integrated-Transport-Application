import { RecentBoardEntry } from "./transportApi";

const STORAGE_KEY = "rit.recentBoards";
const MAX_RECENT_BOARDS = 8;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isRecentBoardEntry(value: unknown): value is RecentBoardEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const location = candidate.location as Record<string, unknown> | undefined;

  return (
    (candidate.mode === "bus" || candidate.mode === "rail") &&
    typeof candidate.href === "string" &&
    typeof candidate.viewedAt === "string" &&
    !!location &&
    (location.type === "station" || location.type === "bus_stop" || location.type === "bus_stop_group") &&
    typeof location.id === "string" &&
    typeof location.code === "string" &&
    typeof location.name === "string"
  );
}

export function readRecentBoards(): RecentBoardEntry[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentBoardEntry);
  } catch {
    return [];
  }
}

export function recordRecentBoard(entry: Omit<RecentBoardEntry, "viewedAt">) {
  if (!canUseStorage()) return;

  const current = readRecentBoards();
  const next: RecentBoardEntry = {
    ...entry,
    viewedAt: new Date().toISOString(),
  };

  const deduped = current.filter(
    (item) =>
      !(
        item.mode === next.mode &&
        item.location.type === next.location.type &&
        item.location.id === next.location.id
      )
  );

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([next, ...deduped].slice(0, MAX_RECENT_BOARDS))
  );
}
