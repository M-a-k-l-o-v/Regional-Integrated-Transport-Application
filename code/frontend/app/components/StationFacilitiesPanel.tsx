import { StationFacilities } from "../lib/transportApi";

type StationFacilitiesPanelProps = {
  facilities: StationFacilities;
};

function YesNo({ value, label }: { value: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`h-2 w-2 rounded-full ${value ? "bg-emerald-500" : "bg-slate-300"}`} />
      <span className={value ? "text-[var(--foreground)]" : "text-[var(--muted)]"}>{label}</span>
    </div>
  );
}

function stepFreeLabel(level: "full" | "partial" | "none"): { text: string; className: string } {
  if (level === "full") return { text: "Full step-free access", className: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300" };
  if (level === "partial") return { text: "Partial step-free access", className: "border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300" };
  return { text: "No step-free access", className: "border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300" };
}

export default function StationFacilitiesPanel({ facilities }: StationFacilitiesPanelProps) {
  const stepFree = stepFreeLabel(facilities.accessibility.stepFreeAccess);

  return (
    <div className="space-y-5">
      {/* Accessibility headline */}
      <div>
        <div className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Accessibility</div>
        <div className={`mt-2 inline-block rounded-full border px-3 py-1 text-xs font-semibold ${stepFree.className}`}>
          {stepFree.text}
        </div>
        {facilities.accessibility.stepFreeNote ? (
          <p className="mt-2 text-sm text-[var(--muted)]">{facilities.accessibility.stepFreeNote}</p>
        ) : null}
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
          <YesNo value={facilities.accessibility.ramp} label="Ramp" />
          <YesNo value={facilities.accessibility.lift} label="Lift" />
          <YesNo value={facilities.accessibility.accessibleToilet} label="Accessible toilet" />
          <YesNo value={facilities.accessibility.inductionLoop} label="Induction loop" />
          <YesNo value={facilities.accessibility.tactileSurfaces} label="Tactile surfaces" />
          <YesNo value={facilities.accessibility.wheelchairAvailable} label="Wheelchair available" />
        </div>
        {facilities.accessibility.staffAssistance ? (
          <p className="mt-2 text-xs text-[var(--muted)]">{facilities.accessibility.staffAssistanceNote}</p>
        ) : null}
      </div>

      {/* Ticket office */}
      <div>
        <div className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Ticket office</div>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="app-stat-tile">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Status</div>
            <div className="mt-1 text-base font-semibold text-[var(--brand-ink)]">
              {facilities.ticketOffice.available ? "Open" : "No ticket office"}
            </div>
          </div>
          {facilities.ticketOffice.hours ? (
            <div className="app-stat-tile">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Hours</div>
              <div className="mt-1 text-sm font-semibold text-[var(--brand-ink)]">{facilities.ticketOffice.hours}</div>
            </div>
          ) : null}
        </div>
        <div className="mt-2">
          <YesNo value={facilities.ticketOffice.ticketMachine} label="Ticket machine" />
        </div>
      </div>

      {/* Parking */}
      <div>
        <div className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Parking</div>
        {facilities.parking.available ? (
          <>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              {facilities.parking.spaces !== null ? (
                <div className="app-stat-tile">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Spaces</div>
                  <div className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">{facilities.parking.spaces}</div>
                </div>
              ) : null}
              {facilities.parking.blueBadgeSpaces !== null ? (
                <div className="app-stat-tile">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Blue badge</div>
                  <div className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">{facilities.parking.blueBadgeSpaces}</div>
                </div>
              ) : null}
              {facilities.parking.charges ? (
                <div className="app-stat-tile">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Charges</div>
                  <div className="mt-1 text-sm font-semibold text-[var(--brand-ink)]">{facilities.parking.charges}</div>
                </div>
              ) : null}
            </div>
            {facilities.parking.operator ? (
              <p className="mt-2 text-xs text-[var(--muted)]">Operated by {facilities.parking.operator}</p>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-sm text-[var(--muted)]">No parking facilities at this station.</p>
        )}
      </div>

      {/* Toilets */}
      <div>
        <div className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Toilets</div>
        {facilities.toilets.available ? (
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
            <YesNo value={facilities.toilets.available} label="Available" />
            <YesNo value={facilities.toilets.accessible} label="Accessible" />
            <YesNo value={facilities.toilets.babyChange} label="Baby change" />
          </div>
        ) : (
          <p className="mt-2 text-sm text-[var(--muted)]">No toilet facilities at this station.</p>
        )}
      </div>

      {/* Amenities */}
      <div>
        <div className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Amenities</div>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
          <YesNo value={facilities.amenities.wifi} label="WiFi" />
          <YesNo value={facilities.amenities.waitingRoom} label="Waiting room" />
          <YesNo value={facilities.amenities.cafe} label="Cafe / refreshments" />
          <YesNo value={facilities.amenities.shops} label="Shops" />
          <YesNo value={facilities.amenities.bikeStorage} label={facilities.amenities.bikeSpaces ? `Bike storage (${facilities.amenities.bikeSpaces})` : "Bike storage"} />
          <YesNo value={facilities.amenities.taxiRank} label="Taxi rank" />
          <YesNo value={facilities.amenities.customerHelpPoint} label="Help point" />
          <YesNo value={facilities.amenities.leftLuggage} label="Left luggage" />
        </div>
      </div>

      {/* Contact */}
      {facilities.contact.address || facilities.contact.phone ? (
        <div>
          <div className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Contact</div>
          {facilities.contact.address ? (
            <p className="mt-2 text-sm text-[var(--foreground)]">{facilities.contact.address}</p>
          ) : null}
          {facilities.contact.phone ? (
            <p className="mt-1 text-sm text-[var(--muted)]">National Rail Enquiries: {facilities.contact.phone}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
