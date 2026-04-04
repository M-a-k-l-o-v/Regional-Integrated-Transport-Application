"use client";

import { useState } from "react";
import { DEFAULT_BUS_DATE, PlannerLocation } from "../lib/transportApi";
import LocationSearchField from "./LocationSearchField";

type BusBoardControlsProps = {
  initialStop?: PlannerLocation | null;
  initialDate?: string;
  query?: string;
};

export default function BusBoardControls({
  initialStop = null,
  initialDate = DEFAULT_BUS_DATE,
  query = "",
}: BusBoardControlsProps) {
  const [stop, setStop] = useState<PlannerLocation | null>(initialStop);
  const canSubmit =
    (stop?.type === "bus_stop" || stop?.type === "bus_stop_group") &&
    stop.id.length > 0;

  return (
    <form action="/location-info/bus" className="space-y-4">
      <input type="hidden" name="q" value={query} />
      <input type="hidden" name="selectedType" value={stop?.type ?? ""} />
      <input type="hidden" name="stopName" value={stop?.name ?? ""} />
      <input type="hidden" name="groupName" value={stop?.type === "bus_stop_group" ? stop.name : ""} />
      <input type="hidden" name="stopCode" value={stop?.code ?? ""} />
      <input type="hidden" name="stopLocalityName" value={stop?.localityName ?? ""} />

      <LocationSearchField
        label="Stop or hub"
        placeholder="Search stop or bus station"
        value={stop}
        onChange={setStop}
        allowedTypes={["bus_stop", "bus_stop_group"]}
        showCodeInLabel={false}
        scheduledOnly
      />
      <input type="hidden" name="stopId" value={stop?.type === "bus_stop" ? stop.id : ""} />
      <input type="hidden" name="groupId" value={stop?.type === "bus_stop_group" ? stop.id : ""} />

      <label className="block space-y-2">
        <span className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--brand-ink)]">
          Service date
        </span>
        <input
          type="date"
          name="date"
          defaultValue={initialDate}
          className="w-full rounded-[1.5rem] border border-[var(--outline)] bg-[var(--input)] px-5 py-3.5 text-[var(--foreground)] shadow-[var(--shadow-soft)] outline-none transition focus:border-[var(--brand)]"
        />
      </label>

      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex rounded-full bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition hover:bg-[var(--brand-ink)] disabled:cursor-not-allowed disabled:bg-zinc-300"
      >
        Load stop board
      </button>

      {!canSubmit ? (
        <p className="rounded-[1.35rem] border border-[var(--outline)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--muted)]">
          Pick a stop or grouped hub from the search suggestions. The page uses the place name you know, then resolves the internal identifiers behind the scenes.
        </p>
      ) : null}
    </form>
  );
}
