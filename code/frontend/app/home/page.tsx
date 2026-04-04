import Link from "next/link";
import AppShell from "../components/AppShell";
import JourneyPlannerForm from "../components/JourneyPlannerForm";
import PageHeader from "../components/PageHeader";
import PanelCard from "../components/PanelCard";
import {
  DEFAULT_BUS_DATE,
  DEFAULT_TRAIN_FROM,
  HealthResponse,
  PlannerLocation,
  fetchJson,
} from "../lib/transportApi";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | undefined>>;
};

function parseLocation(params: Record<string, string | undefined>, prefix: "origin" | "destination"): PlannerLocation | null {
  const type = params[`${prefix}Type`];
  const id = params[`${prefix}Id`];
  const name = params[`${prefix}Name`];
  const code = params[`${prefix}Code`];
  const localityName = params[`${prefix}LocalityName`];
  if ((type !== "station" && type !== "bus_stop" && type !== "bus_stop_group") || !id || !name || !code) {
    return null;
  }
  return { type, id, name, code, localityName: localityName ?? null };
}

const quickBoards = [
  {
    label: "Lancaster rail board",
    description: "Open the current scheduled board for Lancaster station.",
    href: `/location-info/train?crs=LAN&from=${encodeURIComponent(DEFAULT_TRAIN_FROM)}`,
  },
  {
    label: "Lancaster bus station board",
    description: "Inspect the aggregated scheduled board across Lancaster bus station stands.",
    href: `/location-info/bus?groupId=lancaster_bus_station&date=${DEFAULT_BUS_DATE}&groupName=${encodeURIComponent("Lancaster Bus Station")}&stopLocalityName=${encodeURIComponent("Lancaster City Centre")}`,
  },
  {
    label: "Mapped transport search",
    description: "Browse stops and stations on the OpenStreetMap view.",
    href: "/map?q=lanc&mode=both",
  },
];

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = (await searchParams) ?? {};
  const health = await fetchJson<HealthResponse>("/health");
  const backendHealthy = health.data?.ok === true;

  return (
    <AppShell activePath="home">
      <PageHeader
        eyebrow="Journey planner"
        title="Plan a scheduled bus and rail journey"
        description="Choose an origin, a destination, a departure time, and how the planner should trade off speed against changes. Routing v1 is scheduled-only and uses bus, rail, and short walking transfers."
        actions={
          <div className="rounded-[1.7rem] border border-[var(--outline)] bg-[linear-gradient(180deg,var(--surface-soft)_0%,var(--surface)_100%)] px-4 py-4 text-sm text-[var(--foreground)] shadow-[var(--shadow-soft)]">
            <div className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Backend status</div>
            <div className="mt-2 text-lg font-semibold text-[var(--brand-ink)]">
              {backendHealthy ? "Scheduled planner backend online" : "Backend unavailable"}
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Live rail, live bus, weather, road, and facilities remain deferred while the scheduled planner foundation is built.
            </p>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <PanelCard
          eyebrow="Plan"
          title="Build the journey first"
          className="bg-[var(--surface)]"
        >
          <JourneyPlannerForm
            initialOrigin={parseLocation(params, "origin")}
            initialDestination={parseLocation(params, "destination")}
            initialDate={params.date}
            initialTime={params.time}
            initialPreference={
              params.preference === "balanced" || params.preference === "fewest_changes" || params.preference === "fastest"
                ? params.preference
                : undefined
            }
          />
        </PanelCard>

        <div className="grid gap-6">
          <PanelCard eyebrow="Preferences" title="How the planner ranks options">
            <div className="space-y-3 text-sm text-[var(--muted)]">
              <p><span className="font-semibold text-[var(--foreground)]">Fastest</span> ranks by earliest arrival, then by fewer changes.</p>
              <p><span className="font-semibold text-[var(--foreground)]">Balanced</span> adds a 10-minute penalty for each change.</p>
              <p><span className="font-semibold text-[var(--foreground)]">Fewest changes</span> prioritises simpler journeys before arrival time.</p>
            </div>
          </PanelCard>

          <PanelCard eyebrow="Current scope" title="What the current planner can do">
            <ul className="space-y-3 text-sm text-[var(--muted)]">
              <li>Scheduled bus and rail only.</li>
              <li>Walking transfers within 500 metres.</li>
              <li>Manual origin and destination selection via search.</li>
              <li>Departure-after search only.</li>
            </ul>
          </PanelCard>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {quickBoards.map((item) => (
          <PanelCard key={item.label} eyebrow="Quick access" title={item.label}>
            <p className="text-sm text-[var(--muted)]">{item.description}</p>
            <Link
              href={item.href}
              className="mt-4 inline-flex items-center rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition hover:bg-[var(--brand-ink)]"
            >
              Open
            </Link>
          </PanelCard>
        ))}
      </div>
    </AppShell>
  );
}
