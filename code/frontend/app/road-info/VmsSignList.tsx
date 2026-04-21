"use client";

import { VmsSign, formatTimestamp } from "../lib/transportApi";

type VmsSignListProps = {
  signs: VmsSign[];
  selectedId: string | null;
  onSelectSign: (id: string | null) => void;
};

function getUrgencyClass(sign: VmsSign): string {
  if (sign.isBlank) return "border-[var(--outline)]";
  const msg = (sign.message ?? "").toUpperCase();
  if (msg.includes("CLOSED") || msg.includes("ACCIDENT") || msg.includes("INCIDENT"))
    return "border-red-400 bg-red-100 night:bg-red-900 night:text-red-200";
  if (msg.includes("ROADWORKS") || msg.includes("SPEED LIMIT"))
    return "border-orange-500 bg-orange-100 night:bg-orange-900 night:text-orange-200";
  if (msg.includes("DELAY") || msg.includes("QUEUE") || msg.includes("CONGESTION") || msg.includes("FOG") || msg.includes("WIND"))
    return "border-amber-400 bg-amber-100 night:bg-amber-900 night:text-amber-200";
  return "border-blue-300 bg-blue-100 night:bg-blue-900 night:text-blue-200";
}

function getUrgencyDescription(sign: VmsSign): string {
  if (sign.isBlank) return "Blank sign";
  const msg = (sign.message ?? "").toUpperCase();
  if (msg.includes("CLOSED") || msg.includes("ACCIDENT") || msg.includes("INCIDENT"))
    return "Accident or road closure";
  if (msg.includes("ROADWORKS") || msg.includes("SPEED LIMIT"))
    return "Reduce speed";
  if (msg.includes("DELAY") || msg.includes("QUEUE") || msg.includes("CONGESTION") || msg.includes("FOG") || msg.includes("WIND"))
    return "Expect delays";
  return "Normal conditions";
}

function getDirectionColor(direction: string | null): string {
  if (!direction) return "";
  const d = direction.toLowerCase();
  if (d.includes("north")) return "bg-red-100 night:bg-red-950/20";
  if (d.includes("south")) return "bg-blue-100 night:bg-blue-950/20";
  if (d.includes("east")) return "bg-green-100 night:bg-green-950/20";
  if (d.includes("west")) return "bg-amber-100 night:bg-amber-950/20";
  return "bg-neutral-100 night:bg-neutral-950/20"
}

function getDirectionIcon(direction: string | null): string {
  if (!direction) return "";
  const d = direction.toLowerCase();
  if (d.includes("north")) return "N";
  if (d.includes("south")) return "S";
  if (d.includes("east")) return "E";
  if (d.includes("west")) return "W";
  return direction.charAt(0).toUpperCase();
}

export default function VmsSignList({ signs, selectedId, onSelectSign }: VmsSignListProps) {
  const activeSigns = signs.filter((s) => !s.isBlank);
  const blankSigns = signs.filter((s) => s.isBlank);

  return (
    <div className="space-y-3">
      {activeSigns.length === 0 ? (
        <div className="rounded-2xl border border-[var(--outline)] bg-[var(--surface-soft)] px-4 py-6 text-center text-sm text-[var(--muted)]">
          No active VMS messages on this road.
        </div>
      ) : null}

      {activeSigns.map((sign) => {
        const isSelected = sign.id === selectedId;
        return (
          <button
            key={sign.id}
            type="button"
            onClick={() => onSelectSign(isSelected ? null : sign.id)}
            className={`w-full text-left rounded-2xl border-2 px-4 py-3.5 transition border-[var(--outline)] ${isSelected
              ? "ring-2 ring-[var(--brand)] ring-offset-1"
              : "hover:shadow-[var(--shadow-soft)]"
              }`}
          >
            <div className="flex items-start gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${getDirectionColor(sign.direction)} text-sm font-bold text-neutral-900 shadow-sm border border-[var(--outline)]`}>
                {getDirectionIcon(sign.direction)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {sign.junction ?? sign.road}
                  </span>
                  {sign.direction ? (
                    <span className={`rounded-full bg-[var(--surface-accent)] px-2 py-0.5 text-[10px] font-semibold text-neutral-900 border ${getUrgencyClass(sign)}`}>
                      {getUrgencyDescription(sign)}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                  {sign.description}
                </div>
                <div className="mt-2 space-y-0.5">
                  {sign.messageLines.map((line, i) => (
                    <div
                      key={i}
                      className="font-mono text-sm font-bold tracking-wide text-[var(--brand-ink)]"
                    >
                      {line}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                  {sign.setBy ? <span>{sign.setBy}</span> : null}
                  {sign.lastUpdated ? <span>Updated {formatTimestamp(sign.lastUpdated)}</span> : null}
                </div>
              </div>
            </div>
          </button>
        );
      })}

      {blankSigns.length > 0 ? (
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Inactive signs ({blankSigns.length})
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {blankSigns.map((sign) => (
              <button
                key={sign.id}
                type="button"
                onClick={() => onSelectSign(sign.id === selectedId ? null : sign.id)}
                className={`w-full text-left rounded-xl border border-[var(--outline)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm transition hover:shadow-sm ${sign.id === selectedId ? "ring-2 ring-[var(--brand)] ring-offset-1" : ""
                  }`}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                  <span className="font-medium text-[var(--foreground)]">{sign.junction ?? sign.id}</span>
                  {sign.direction ? (
                    <span className="text-xs text-[var(--muted)]">{sign.direction}</span>
                  ) : null}
                </div>
                <div className="mt-0.5 truncate text-xs text-[var(--muted)]">{sign.description}</div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
