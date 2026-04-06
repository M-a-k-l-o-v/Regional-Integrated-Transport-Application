"use client";

import { useState } from "react";
import { DEFAULT_TRAIN_FROM, PlannerLocation } from "../lib/transportApi";
import LocationSearchField from "./LocationSearchField";

type TrainBoardControlsProps = {
  initialStation?: PlannerLocation | null;
  initialFrom?: string;
  query?: string;
};

export default function TrainBoardControls({
  initialStation = null,
  initialFrom = DEFAULT_TRAIN_FROM,
  query = "",
}: TrainBoardControlsProps) {
  const [station, setStation] = useState<PlannerLocation | null>(initialStation);
  const canSubmit = station?.type === "station" && station.code.length === 3;

  return (
    <form action="/location-info/train" className="space-y-4">
      <input type="hidden" name="q" value={query} />
      <input type="hidden" name="stationName" value={station?.name ?? ""} />
      <input type="hidden" name="crs" value={station?.type === "station" ? station.code : ""} />

      <LocationSearchField
        label="Station"
        placeholder="Search station name"
        value={station}
        onChange={setStation}
        allowedTypes={["station"]}
        showCodeInLabel={false}
      />

      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Depart after
        </span>
        <input
          type="datetime-local"
          name="from"
          defaultValue={initialFrom.replace(".000Z", "").replace(/Z$/, "")}
          className="w-full rounded-xl border border-[var(--outline)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)]"
        />
      </label>

      <button
        type="submit"
        disabled={!canSubmit}
        className="flex h-11 w-full items-center justify-center rounded-xl bg-[var(--brand)] text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Load rail board
      </button>

      {!canSubmit ? (
        <p className="rounded-xl border border-[var(--outline)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--muted)]">
          Pick a station from the search suggestions.
        </p>
      ) : null}
    </form>
  );
}
