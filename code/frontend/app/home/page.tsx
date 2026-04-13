import Link from "next/link";
import AppShell from "../components/AppShell";
import JourneyPlannerForm from "../components/JourneyPlannerForm";
import PanelCard from "../components/PanelCard";
import RecentBoardStrip from "../components/RecentBoardStrip";
import {
  DEFAULT_BUS_DATE,
  DEFAULT_TRAIN_FROM,
  HealthResponse,
  PlannerLocation,
  fetchJson,
  getLondonCurrentPlannerDefaults,
  getLondonGreeting,
  getLondonTodayDate,
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

const quickLinks = [
  {
    label: "Lancaster Station",
    sub: "Rail departures",
    type: "rail" as const,
    href: `/location-info/train?crs=LAN&from=${encodeURIComponent(DEFAULT_TRAIN_FROM)}`,
  },
  {
    label: "Lancaster Bus Station",
    sub: "Bus departures",
    type: "bus" as const,
    href: `/location-info/bus?groupId=lancaster_bus_station&date=${DEFAULT_BUS_DATE}&groupName=${encodeURIComponent("Lancaster Bus Station")}&stopLocalityName=${encodeURIComponent("Lancaster City Centre")}`,
  },
  {
    label: "Preston Station",
    sub: "Rail departures",
    type: "rail" as const,
    href: `/location-info/train?crs=PRE&from=${encodeURIComponent(DEFAULT_TRAIN_FROM)}`,
  },
  {
    label: "Morecambe Station",
    sub: "Rail departures",
    type: "rail" as const,
    href: `/location-info/train?crs=MCM&from=${encodeURIComponent(DEFAULT_TRAIN_FROM)}`,
  },
];

function getTimeOfDayTip(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "Late night services may be limited. Check timetables before travelling.";
  if (hour < 9) return "Morning peak hours — allow extra time for busy services.";
  if (hour < 16) return "Off-peak fares may apply on some rail services.";
  if (hour < 19) return "Evening peak — services may be busier than usual.";
  return "Last services depart soon. Check departure boards for final times.";
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = (await searchParams) ?? {};
  const health = await fetchJson<HealthResponse>("/health");
  const backendHealthy = health.data?.ok === true;
  const plannerDefaults = getLondonCurrentPlannerDefaults();
  const greeting = getLondonGreeting();
  const todayDate = getLondonTodayDate();

  return (
    <AppShell activePath="home">
      {/* Greeting row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">{greeting}</h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">Where do you want to go?</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--muted)]">{backendHealthy ? "Online" : "Offline"}</span>
          <div className={`h-2.5 w-2.5 rounded-full ${backendHealthy ? "bg-emerald-500" : "bg-red-400"}`} />
        </div>
      </div>

      {/* Two-column layout on desktop */}
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Left: planner */}
        <PanelCard>
          <JourneyPlannerForm
            initialOrigin={parseLocation(params, "origin")}
            initialDestination={parseLocation(params, "destination")}
            initialDate={params.date ?? plannerDefaults.date}
            initialTime={params.time ?? plannerDefaults.time}
            initialPreference={
              params.preference === "balanced" || params.preference === "fewest_changes" || params.preference === "fastest"
                ? params.preference
                : undefined
            }
          />
        </PanelCard>

        {/* Right: quick links + tip */}
        <div className="flex flex-col gap-4">
          <PanelCard title="Quick links" className="flex-1">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {quickLinks.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="group flex items-center gap-3 rounded-xl border border-[var(--outline)] bg-[var(--surface-soft)] px-3 py-2.5 transition hover:border-[var(--brand)] hover:shadow-[var(--shadow-soft)]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-light)]">
                    {item.type === "rail" ? (
                      <svg className="h-4 w-4 text-[var(--brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17l-2 4m8-4l2 4M4 4h16a1 1 0 011 1v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5a1 1 0 011-1zm5 12h6M12 4v4" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4 text-[var(--brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 17a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2zM6 4h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2zm0 8h12" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-[var(--foreground)]">{item.label}</div>
                    <div className="text-xs text-[var(--muted)]">{item.sub}</div>
                  </div>
                  <svg className="h-4 w-4 shrink-0 text-[var(--muted)] transition group-hover:text-[var(--brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </PanelCard>

          {/* Explore map CTA */}
          <Link
            href="/map?q=lanc&mode=both"
            className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--outline)] bg-[var(--brand-light)] px-4 py-3 transition hover:shadow-[var(--shadow-soft)]"
          >
            <svg className="h-5 w-5 text-[var(--brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div className="flex-1">
              <div className="text-sm font-semibold text-[var(--brand)]">Explore the network map</div>
              <div className="text-xs text-[var(--muted)]">View stops and stations nearby</div>
            </div>
            <svg className="h-4 w-4 text-[var(--brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          {/* M6 road info CTA */}
          <Link
            href="/road-info"
            className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--outline)] bg-amber-50 px-4 py-3 transition hover:shadow-[var(--shadow-soft)] dark:bg-amber-950/20"
          >
            <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l3-18m0 18l3-18M4 8h18M2 16h18" />
            </svg>
            <div className="flex-1">
              <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">M6 road signs</div>
              <div className="text-xs text-[var(--muted)]">VMS messages for the M6 corridor</div>
            </div>
            <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Recent boards */}
      <RecentBoardStrip />

      {/* Travel tip */}
      <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--outline)] bg-[var(--surface-soft)] px-4 py-3">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 10v6" strokeLinecap="round" />
          <circle cx="12" cy="7.2" r="1" fill="currentColor" stroke="none" />
        </svg>
        <p className="text-sm text-[var(--muted)]">{getTimeOfDayTip()}</p>
      </div>
    </AppShell>
  );
}
