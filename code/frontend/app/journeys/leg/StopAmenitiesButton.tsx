"use client";

import { useCallback, useState } from "react";
import { StationFacilities, StationFacilitiesResponse, getApiBaseUrl } from "../../lib/transportApi";

type StopAmenitiesButtonProps = {
  stopName: string;
  stopCode: string;
  stopType: string;
};

function YesNo({ value, label }: { value: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={`h-1.5 w-1.5 rounded-full ${value ? "bg-emerald-500" : "bg-slate-300"}`} />
      <span className={value ? "text-[var(--foreground)]" : "text-[var(--muted)]"}>{label}</span>
    </div>
  );
}

function stepFreeLabel(level: "full" | "partial" | "none"): { text: string; className: string } {
  if (level === "full") return { text: "Full step-free", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300" };
  if (level === "partial") return { text: "Partial step-free", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300" };
  return { text: "No step-free", className: "bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300" };
}

function FacilitiesPopup({ facilities, onClose }: { facilities: StationFacilities; onClose: () => void }) {
  const stepFree = stepFreeLabel(facilities.accessibility.stepFreeAccess);

  return (
    <>
      <div className="fixed inset-0 z-[950] bg-black/30" onClick={onClose} />
      <div className="fixed inset-x-4 bottom-4 top-auto z-[951] max-h-[70vh] overflow-y-auto rounded-2xl border border-[var(--outline)] bg-[var(--surface)] p-5 shadow-[0_-12px_40px_rgba(0,0,0,0.2)] sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[var(--foreground)]">{facilities.name}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${stepFree.className}`}>
            {stepFree.text}
          </span>
          <span className="text-xs text-[var(--muted)]">{facilities.staffed ? "Staffed" : "Unstaffed"}</span>
        </div>

        <div className="mt-4 space-y-4">
          {/* Ticket office */}
          <div>
            <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Ticket office</div>
            <div className="mt-1 text-sm text-[var(--foreground)]">
              {facilities.ticketOffice.available ? facilities.ticketOffice.hours ?? "Open" : "No ticket office"}
            </div>
            <YesNo value={facilities.ticketOffice.ticketMachine} label="Ticket machine" />
          </div>

          {/* Accessibility */}
          <div>
            <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Accessibility</div>
            {facilities.accessibility.stepFreeNote ? (
              <p className="mt-1 text-xs text-[var(--muted)]">{facilities.accessibility.stepFreeNote}</p>
            ) : null}
            <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
              <YesNo value={facilities.accessibility.lift} label="Lift" />
              <YesNo value={facilities.accessibility.ramp} label="Ramp" />
              <YesNo value={facilities.accessibility.accessibleToilet} label="Accessible toilet" />
              <YesNo value={facilities.accessibility.wheelchairAvailable} label="Wheelchair" />
              <YesNo value={facilities.accessibility.inductionLoop} label="Induction loop" />
              <YesNo value={facilities.accessibility.staffAssistance} label="Staff assistance" />
            </div>
          </div>

          {/* Parking */}
          {facilities.parking.available ? (
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Parking</div>
              <div className="mt-1 flex flex-wrap gap-3 text-sm">
                {facilities.parking.spaces !== null ? (
                  <span className="font-semibold text-[var(--foreground)]">{facilities.parking.spaces} spaces</span>
                ) : null}
                {facilities.parking.blueBadgeSpaces !== null ? (
                  <span className="text-[var(--muted)]">{facilities.parking.blueBadgeSpaces} blue badge</span>
                ) : null}
                {facilities.parking.charges ? (
                  <span className="text-[var(--muted)]">{facilities.parking.charges}</span>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Toilets */}
          <div>
            <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Toilets</div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
              <YesNo value={facilities.toilets.available} label="Available" />
              <YesNo value={facilities.toilets.accessible} label="Accessible" />
              <YesNo value={facilities.toilets.babyChange} label="Baby change" />
            </div>
          </div>

          {/* Amenities */}
          <div>
            <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--muted)]">Amenities</div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
              <YesNo value={facilities.amenities.wifi} label="WiFi" />
              <YesNo value={facilities.amenities.waitingRoom} label="Waiting room" />
              <YesNo value={facilities.amenities.cafe} label="Cafe" />
              <YesNo value={facilities.amenities.bikeStorage} label={facilities.amenities.bikeSpaces ? `Bike (${facilities.amenities.bikeSpaces})` : "Bike storage"} />
              <YesNo value={facilities.amenities.taxiRank} label="Taxi rank" />
              <YesNo value={facilities.amenities.shops} label="Shops" />
              <YesNo value={facilities.amenities.customerHelpPoint} label="Help point" />
              <YesNo value={facilities.amenities.leftLuggage} label="Left luggage" />
            </div>
          </div>

          {/* Contact */}
          {facilities.contact.address ? (
            <div className="text-xs text-[var(--muted)]">{facilities.contact.address}</div>
          ) : null}
        </div>
      </div>
    </>
  );
}

export default function StopAmenitiesButton({ stopName, stopCode, stopType }: StopAmenitiesButtonProps) {
  const [open, setOpen] = useState(false);
  const [facilities, setFacilities] = useState<StationFacilities | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStation = stopType === "station" || stopCode.length === 3;

  const handleOpen = useCallback(async () => {
    if (facilities) {
      setOpen(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/rail/stations/${encodeURIComponent(stopCode)}/facilities`, { cache: "no-store" });
      if (!response.ok) {
        setError("Unavailable");
        setLoading(false);
        return;
      }
      const data: StationFacilitiesResponse = await response.json();
      if (data.facilities) {
        setFacilities(data.facilities);
        setOpen(true);
      } else {
        setError("No data");
      }
    } catch {
      setError("Failed");
    } finally {
      setLoading(false);
    }
  }, [facilities, stopCode]);

  if (!isStation) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={loading}
        className="inline-flex items-center gap-1 rounded-full border border-[var(--outline)] bg-[var(--surface-soft)] px-2.5 py-1 text-[0.65rem] font-semibold text-[var(--brand)] transition hover:border-[var(--brand)] hover:bg-[var(--surface-accent)] disabled:opacity-50"
        title={`View ${stopName} facilities`}
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 10v6" strokeLinecap="round" />
          <circle cx="12" cy="7.2" r="1" fill="currentColor" stroke="none" />
        </svg>
        {loading ? "Loading…" : error ?? "Amenities"}
      </button>

      {open && facilities ? (
        <FacilitiesPopup facilities={facilities} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
