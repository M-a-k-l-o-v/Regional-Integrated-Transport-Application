"use client";

import { useState } from "react";
import {
  DEFAULT_PLANNER_DATE,
  DEFAULT_PLANNER_TIME,
  JourneyPreference,
  PlannerLocation,
} from "../lib/transportApi";
import LocationSearchField from "./LocationSearchField";

type JourneyPlannerFormProps = {
  initialOrigin?: PlannerLocation | null;
  initialDestination?: PlannerLocation | null;
  initialDate?: string;
  initialTime?: string;
  initialPreference?: JourneyPreference;
};

const preferences: Array<{ value: JourneyPreference; label: string; description: string }> = [
  { value: "fastest", label: "Fastest", description: "Earliest arrival first." },
  { value: "balanced", label: "Balanced", description: "A modest transfer penalty." },
  { value: "fewest_changes", label: "Fewest changes", description: "Prefer simpler journeys." },
];

export default function JourneyPlannerForm({
  initialOrigin = null,
  initialDestination = null,
  initialDate = DEFAULT_PLANNER_DATE,
  initialTime = DEFAULT_PLANNER_TIME,
  initialPreference = "fastest",
}: JourneyPlannerFormProps) {
  const [origin, setOrigin] = useState<PlannerLocation | null>(initialOrigin);
  const [destination, setDestination] = useState<PlannerLocation | null>(initialDestination);
  const [preference, setPreference] = useState<JourneyPreference>(initialPreference);

  const canSubmit =
    origin !== null &&
    destination !== null &&
    !(origin.type === destination.type && origin.id === destination.id);

  return (
    <form action="/journeys" className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:items-end">
        <LocationSearchField
          label="From"
          placeholder="Search origin station or stop"
          value={origin}
          onChange={setOrigin}
        />

        <button
          type="button"
          className="inline-flex h-13 items-center justify-center rounded-full border border-[var(--outline)] bg-[linear-gradient(180deg,var(--surface-strong)_0%,var(--surface-soft)_100%)] px-5 text-sm font-semibold text-[var(--brand-ink)] shadow-[var(--shadow-soft)] transition hover:bg-[var(--surface-alt-hover)]"
          onClick={() => {
            setOrigin(destination);
            setDestination(origin);
          }}
        >
          Swap
        </button>

        <LocationSearchField
          label="To"
          placeholder="Search destination station or stop"
          value={destination}
          onChange={setDestination}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--brand-ink)]">Date</span>
          <input
            type="date"
            name="date"
            defaultValue={initialDate}
            className="w-full rounded-[1.5rem] border border-[var(--outline)] bg-[var(--input)] px-5 py-3.5 text-base text-[var(--foreground)] shadow-[var(--shadow-soft)] outline-none transition focus:border-[var(--brand)]"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--brand-ink)]">Time</span>
          <input
            type="time"
            name="time"
            defaultValue={initialTime}
            className="w-full rounded-[1.5rem] border border-[var(--outline)] bg-[var(--input)] px-5 py-3.5 text-base text-[var(--foreground)] shadow-[var(--shadow-soft)] outline-none transition focus:border-[var(--brand)]"
          />
        </label>
      </div>

      <div className="grid gap-5">
        <div className="space-y-2">
          <span className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--brand-ink)]">Preference</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {preferences.map((option) => {
              const active = preference === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`rounded-[1.6rem] border px-4 py-4 text-left text-sm shadow-[var(--shadow-soft)] transition ${
                    active
                      ? "border-[var(--brand)] bg-[linear-gradient(180deg,var(--surface-accent-strong)_0%,var(--surface-accent)_100%)] text-[var(--brand-ink)]"
                      : "border-[var(--outline)] bg-[linear-gradient(180deg,var(--surface-strong)_0%,var(--surface)_100%)] text-[var(--muted)] hover:border-[var(--outline)] hover:bg-[var(--surface-alt)]"
                  }`}
                  onClick={() => setPreference(option.value)}
                >
                  <div className="font-semibold text-[var(--brand-ink)]">{option.label}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{option.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-13 w-full items-center justify-center rounded-full bg-[var(--brand)] px-7 text-base font-semibold text-white shadow-[var(--shadow-soft)] transition hover:bg-[var(--brand-ink)] disabled:cursor-not-allowed disabled:bg-zinc-300 sm:w-fit"
        >
          Plan journey
        </button>
      </div>

      <input type="hidden" name="preference" value={preference} />
      <input type="hidden" name="originType" value={origin?.type ?? ""} />
      <input type="hidden" name="originId" value={origin?.id ?? ""} />
      <input type="hidden" name="originName" value={origin?.name ?? ""} />
      <input type="hidden" name="originCode" value={origin?.code ?? ""} />
      <input type="hidden" name="originLocalityName" value={origin?.localityName ?? ""} />
      <input type="hidden" name="destinationType" value={destination?.type ?? ""} />
      <input type="hidden" name="destinationId" value={destination?.id ?? ""} />
      <input type="hidden" name="destinationName" value={destination?.name ?? ""} />
      <input type="hidden" name="destinationCode" value={destination?.code ?? ""} />
      <input type="hidden" name="destinationLocalityName" value={destination?.localityName ?? ""} />

      {!canSubmit ? (
        <p className="rounded-[1.35rem] border border-[var(--outline)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--muted)]">
          Select both ends of the journey from the search suggestions to unlock route planning.
        </p>
      ) : null}
    </form>
  );
}
