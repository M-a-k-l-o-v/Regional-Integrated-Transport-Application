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
        <span className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--brand-ink)]">
          Depart after
        </span>
        <input
          type="datetime-local"
          name="from"
          defaultValue={initialFrom.replace(".000Z", "").replace(/Z$/, "")}
          className="w-full rounded-[1.5rem] border border-[var(--outline)] bg-[var(--input)] px-5 py-3.5 text-[var(--foreground)] shadow-[var(--shadow-soft)] outline-none transition focus:border-[var(--brand)]"
        />
      </label>

      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex rounded-full bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition hover:bg-[var(--brand-ink)] disabled:cursor-not-allowed disabled:bg-zinc-300"
      >
        Load rail board
      </button>

      {!canSubmit ? (
        <p className="rounded-[1.35rem] border border-[var(--outline)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--muted)]">
          Pick a station from the search suggestions. The page resolves the internal CRS code behind the scenes.
        </p>
      ) : null}
    </form>
  );
}
