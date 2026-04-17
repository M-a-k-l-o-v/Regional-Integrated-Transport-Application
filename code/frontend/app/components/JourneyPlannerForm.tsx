"use client";

import { useState } from "react";
import {
  JourneyPreference,
  PlannerLocation,
  TransitModeFilter,
  getLondonCurrentPlannerDefaults,
} from "../lib/transportApi";
import LocationSearchField from "./LocationSearchField";
import DateTimeWheelPicker from "./ScrollWheelPicker";

type JourneyPlannerFormProps = {
  initialOrigin?: PlannerLocation | null;
  initialDestination?: PlannerLocation | null;
  initialDate?: string;
  initialTime?: string;
  initialPreference?: JourneyPreference;
  initialModes?: TransitModeFilter[];
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatPickerDisplay(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);

  let dateLabel: string;
  if (diff === 0) dateLabel = "Today";
  else if (diff === 1) dateLabel = "Tomorrow";
  else if (diff === -1) dateLabel = "Yesterday";
  else dateLabel = `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;

  return `${dateLabel}, ${timeStr}`;
}

const preferences: Array<{ value: JourneyPreference; label: string }> = [
  { value: "fastest", label: "Fastest" },
  { value: "balanced", label: "Balanced" },
  { value: "fewest_changes", label: "Fewest changes" },
];

const ALL_MODES: TransitModeFilter[] = ["bus", "rail"];

const modeOptions: Array<{ value: TransitModeFilter; label: string; icon: React.ReactNode }> = [
  {
    value: "rail",
    label: "Rail",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17l-2 4m8-4l2 4M4 4h16a1 1 0 011 1v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5a1 1 0 011-1zm5 12h6M12 4v4" />
      </svg>
    ),
  },
  {
    value: "bus",
    label: "Bus",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 17a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2zM6 4h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2zm0 8h12" />
      </svg>
    ),
  },
];

export default function JourneyPlannerForm({
  initialOrigin = null,
  initialDestination = null,
  initialDate,
  initialTime,
  initialPreference = "fastest",
  initialModes,
}: JourneyPlannerFormProps) {
  const plannerDefaults = getLondonCurrentPlannerDefaults();
  const resolvedDate = initialDate ?? plannerDefaults.date;
  const resolvedTime = initialTime ?? plannerDefaults.time;
  const [origin, setOrigin] = useState<PlannerLocation | null>(initialOrigin);
  const [destination, setDestination] = useState<PlannerLocation | null>(initialDestination);
  const [preference, setPreference] = useState<JourneyPreference>(initialPreference);
  const [date, setDate] = useState(resolvedDate);
  const [time, setTime] = useState(resolvedTime);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [modes, setModes] = useState<TransitModeFilter[]>(initialModes ?? ALL_MODES);

  const canSubmit =
    origin !== null &&
    destination !== null &&
    !(origin.type === destination.type && origin.id === destination.id);

  return (
    <form action="/journeys" className="space-y-4">
      {/* Origin / Destination */}
      <div className="relative space-y-3">
        <LocationSearchField
          label="From"
          placeholder="Search station or stop"
          value={origin}
          onChange={setOrigin}
          transitModes={modes}
        />
        <LocationSearchField
          label="To"
          placeholder="Search destination"
          value={destination}
          onChange={setDestination}
          transitModes={modes}
        />
        {/* Swap button */}
        <button
          type="button"
          className="absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--outline)] bg-[var(--surface)] text-[var(--brand)] shadow-[var(--shadow-soft)] transition hover:bg-[var(--surface-soft)]"
          onClick={() => { setOrigin(destination); setDestination(origin); }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </button>
      </div>

      {/* Mode filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        {modeOptions.map((option) => {
          const active = modes.includes(option.value);
          const both = modes.length === ALL_MODES.length;
          return (
            <button
              key={option.value}
              type="button"
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${active && !both
                ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                : "border-[var(--outline)] bg-[var(--surface)] text-[var(--foreground)]"
                }`}
              onClick={() => {
                if (active && modes.length === 1) return;
                setModes([option.value]);
              }}
            >
              {option.icon}
              {option.label}
            </button>
          );
        })}
        <button
          type="button"
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${modes.length === ALL_MODES.length
            ? "border-[var(--brand)] bg-[var(--brand)] text-white"
            : "border-[var(--outline)] bg-[var(--surface)] text-[var(--foreground)]"
            }`}
          onClick={() => setModes([...ALL_MODES])}
        >
          Both
        </button>
      </div>

      {modes.map((m) => (
        <input key={m} type="hidden" name="modes" value={m} />
      ))}

      {/* Departure time */}
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-[var(--outline)] bg-[var(--surface)] px-4 py-3 text-left transition hover:border-[var(--brand)]"
      >
        <svg className="h-5 w-5 shrink-0 text-[var(--brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm font-semibold text-[var(--foreground)]">
          {formatPickerDisplay(date, time)}
        </span>
      </button>
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time} />

      <DateTimeWheelPicker
        date={date}
        time={time}
        open={pickerOpen}
        onConfirm={(newDate, newTime) => { setDate(newDate); setTime(newTime); }}
        onClose={() => setPickerOpen(false)}
      />

      {/* Preference */}
      <div className="flex flex-wrap gap-2">
        {preferences.map((option) => {
          const active = preference === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`min-h-11 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${active
                ? "border-[var(--brand)] bg-[var(--brand-light)] text-[var(--brand)]"
                : "border-[var(--outline)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-soft)]"
                }`}
              onClick={() => setPreference(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        Find routes
      </button>

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
    </form>
  );
}
