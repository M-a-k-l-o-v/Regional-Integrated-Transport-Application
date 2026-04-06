import AppShell from "../components/AppShell";
import PageHeader from "../components/PageHeader";
import PanelCard from "../components/PanelCard";
import { VmsResponse, fetchJson, formatTimestamp } from "../lib/transportApi";
import VmsExplorer from "./VmsExplorer";

export const dynamic = "force-dynamic";

export default async function RoadInfoPage() {
  const result = await fetchJson<VmsResponse>("/road/vms?road=M6");
  const vms = result.data;
  const activeSigns = vms?.signs.filter((s) => !s.isBlank) ?? [];

  return (
    <AppShell activePath="roads">
      <PageHeader
        eyebrow="Road information"
        title="M6 Motorway — Variable Message Signs"
        description="Live and recent VMS messages along the M6 corridor through Lancashire, from Junction 28 (Leyland) to Junction 34 (Lancaster)."
        backHref="/home"
        backLabel="Home"
      />

      {/* Summary stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="app-stat-tile">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Road</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">M6</div>
        </div>
        <div className="app-stat-tile">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Total signs</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">{vms?.signs.length ?? 0}</div>
        </div>
        <div className="app-stat-tile">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Active messages</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--brand-ink)]">{activeSigns.length}</div>
        </div>
        <div className="app-stat-tile">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Last fetched</div>
          <div className="mt-1 text-lg font-semibold text-[var(--brand-ink)]">
            {vms?.fetchedAt ? formatTimestamp(vms.fetchedAt) : "Unknown"}
          </div>
        </div>
      </div>

      {result.error ? (
        <PanelCard eyebrow="Error" title="Unable to load VMS data">
          <p className="text-sm text-rose-700">{result.error}</p>
        </PanelCard>
      ) : null}

      {vms ? (
        <VmsExplorer signs={vms.signs} />
      ) : !result.error ? (
        <PanelCard eyebrow="VMS" title="No data available">
          <p className="text-sm text-[var(--muted)]">VMS data could not be retrieved at this time.</p>
        </PanelCard>
      ) : null}

      {/* Corridor info */}
      <PanelCard eyebrow="About" title="M6 Lancashire corridor">
        <div className="space-y-3 text-sm text-[var(--muted)]">
          <p>
            Variable Message Signs (VMS) are electronic signs positioned above or alongside motorways.
            They display real-time information about traffic conditions, speed limits, lane closures,
            weather warnings, and other safety messages set by National Highways.
          </p>
          <p>
            This page covers the M6 through Lancashire between Junction 28 (Leyland) and
            Junction 34 (Lancaster/Morecambe), including the M55 and M65 interchange areas.
            Signs are managed by the National Highways North West regional control centre.
          </p>
          <div className="grid gap-3 pt-2 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--outline)] bg-[var(--surface-soft)] px-3 py-2.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Coverage</div>
              <div className="mt-1 font-semibold text-[var(--foreground)]">J28 – J34</div>
            </div>
            <div className="rounded-xl border border-[var(--outline)] bg-[var(--surface-soft)] px-3 py-2.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Operator</div>
              <div className="mt-1 font-semibold text-[var(--foreground)]">National Highways</div>
            </div>
            <div className="rounded-xl border border-[var(--outline)] bg-[var(--surface-soft)] px-3 py-2.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Refresh</div>
              <div className="mt-1 font-semibold text-[var(--foreground)]">Every 5 min</div>
            </div>
          </div>
        </div>
      </PanelCard>
    </AppShell>
  );
}
