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
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Service date
        </span>
        <input
          type="date"
          name="date"
          defaultValue={initialDate}
          className="w-full rounded-xl border border-[var(--outline)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]"
        />
      </label>

      <button
        type="submit"
        disabled={!canSubmit}
        className="flex h-11 w-full items-center justify-center rounded-xl bg-[var(--brand)] text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Load stop board
      </button>

      {!canSubmit ? (
        <p className="rounded-xl border border-[var(--outline)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--muted)]">
          Pick a stop or grouped hub from the search suggestions.
        </p>
      ) : null}
    </form>
  );
}
