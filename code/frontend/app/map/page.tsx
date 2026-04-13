import Link from "next/link";
import AppShell from "../components/AppShell";
import ModeTabs from "../components/ModeTabs";
import PageHeader from "../components/PageHeader";
import PanelCard from "../components/PanelCard";
import MapCanvas from "./MapCanvas";
import {
  PlannerLocation,
  SearchResponse,
  buildBoardHref,
  fetchJson,
} from "../lib/transportApi";

export const dynamic = "force-dynamic";

type MapPageProps = {
  searchParams?: Promise<{
    q?: string;
    mode?: string;
    focus?: string;
  }>;
};

type MapMode = "rail" | "bus" | "both";

type MapItem = PlannerLocation & {
  latitude: number;
  longitude: number;
  boardHref: string;
  focusHref: string;
};

function parseMode(value: string | undefined): MapMode {
  if (value === "rail" || value === "bus") return value;
  return "both";
}

function modeHref(q: string, mode: MapMode, focus?: string): string {
  const params = new URLSearchParams();
  if (q.length > 0) params.set("q", q);
  params.set("mode", mode);
  if (focus) params.set("focus", focus);
  return `/map?${params.toString()}`;
}

export default async function MapPage({ searchParams }: MapPageProps) {
  const params = (await searchParams) ?? {};
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const effectiveQuery = q.length >= 2 ? q : "lanc";
  const mode = parseMode(typeof params.mode === "string" ? params.mode : undefined);
  const focus = typeof params.focus === "string" ? params.focus.trim() : "";

  const searchResult = await fetchJson<SearchResponse>(
    `/search?q=${encodeURIComponent(effectiveQuery)}&limit=30&scheduledOnly=true`
  );

  const rawResults = searchResult.data?.results ?? [];
  const filtered = rawResults.filter((result) => {
    if (result.latitude === null || result.longitude === null) return false;
    if (mode === "rail") return result.type === "station";
    if (mode === "bus") return result.type === "bus_stop" || result.type === "bus_stop_group";
    return true;
  });

  const mapItems: MapItem[] = filtered.map((result) => ({
    id: result.id,
    type: result.type,
    code: result.code,
    name: result.name,
    localityName: result.localityName,
    latitude: result.latitude as number,
    longitude: result.longitude as number,
    boardHref: buildBoardHref({
      type: result.type,
      id: result.id,
      code: result.code,
      name: result.name,
      localityName: result.localityName,
    }, effectiveQuery),
    focusHref: modeHref(effectiveQuery, mode, result.id),
  }));

  const activeItem =
    mapItems.find((item) => item.id === focus || item.code === focus) ??
    mapItems[0] ??
    null;

  // Show live vehicle positions for bus/both modes using known Lancashire operators
  const vehicleOperatorIds =
    mode === "rail" ? [] : ["LNCS", "PC", "ANW", "GONW"];

  const renderMapSheet = (tone: "light" | "default") => {
    const isLight = tone === "light";
    const eyebrowClass = isLight
      ? "text-xs font-semibold uppercase tracking-wider text-slate-400"
      : "text-xs font-semibold uppercase tracking-wider text-[var(--muted)]";
    const titleClass = isLight
      ? "mt-1.5 text-lg font-bold text-slate-900"
      : "mt-1.5 text-lg font-bold text-[var(--foreground)]";
    const bodyClass = isLight
      ? "mt-1.5 text-sm text-slate-500"
      : "mt-1.5 text-sm text-[var(--muted)]";
    const badgeClass = isLight
      ? "rounded-full border border-slate-200 bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
      : "rounded-full border border-[var(--outline)] bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--muted)]";
    const inputWrapClass = isLight
      ? "flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
      : "flex items-center gap-3 rounded-xl border border-[var(--outline)] bg-[var(--surface)] px-4 py-3";
    const inputClass = isLight
      ? "w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
      : "w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]";
    const selectedCardClass = isLight
      ? "rounded-xl border border-slate-200 bg-white p-4"
      : "rounded-xl border border-[var(--outline)] bg-[var(--surface)] p-4";
    const selectedEyebrowClass = isLight
      ? "text-xs font-semibold uppercase tracking-wider text-slate-400"
      : "text-xs font-semibold uppercase tracking-wider text-[var(--muted)]";
    const selectedTitleClass = isLight
      ? "mt-1.5 text-lg font-bold text-slate-900"
      : "mt-1.5 text-lg font-bold text-[var(--foreground)]";
    const selectedMetaClass = isLight
      ? "mt-1.5 text-sm text-slate-500"
      : "mt-1.5 text-sm text-[var(--muted)]";
    const matchesEyebrowClass = isLight
      ? "text-xs font-semibold uppercase tracking-wider text-slate-400"
      : "text-xs font-semibold uppercase tracking-wider text-[var(--muted)]";
    const emptyClass = isLight
      ? "rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
      : "rounded-xl border border-[var(--outline)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--muted)]";
    const resultCardClass = isLight
      ? "rounded-xl border border-slate-200 bg-white p-4"
      : "app-list-card";
    const resultTypeClass = isLight
      ? "text-xs font-semibold uppercase tracking-wider text-slate-400"
      : "text-xs font-semibold uppercase tracking-wider text-[var(--muted)]";
    const resultTitleClass = isLight
      ? "mt-1 text-base font-bold text-slate-900"
      : "mt-1 text-base font-bold text-[var(--foreground)]";
    const resultMetaClass = isLight
      ? "mt-1 text-sm text-slate-500"
      : "mt-1 text-sm text-[var(--muted)]";
    const focusButtonClass = isLight
      ? "rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700"
      : "rounded-full bg-[var(--surface-accent)] px-4 py-2 text-sm font-semibold text-[var(--brand)]";

    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className={eyebrowClass}>Network map</div>
            <div className={titleClass}>Search mapped stops and stations</div>
            <div className={bodyClass}>
              Focus a mapped result, open its board, and keep the scheduled-only map view aligned with the journey explorer.
            </div>
          </div>
          <div className={badgeClass}>{mapItems.length} mapped</div>
        </div>

        <form action="/map" className="grid gap-3">
          <input type="hidden" name="mode" value={mode} />
          <div className={inputWrapClass}>
            <span className={isLight ? "text-lg text-emerald-400" : "text-lg text-[var(--brand)]"}>⌕</span>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search area, station, or stop"
              className={inputClass}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ModeTabs
              tabs={[
                { label: "Rail", href: modeHref(effectiveQuery, "rail", activeItem?.id), active: mode === "rail" },
                { label: "Bus", href: modeHref(effectiveQuery, "bus", activeItem?.id), active: mode === "bus" },
                { label: "Both", href: modeHref(effectiveQuery, "both", activeItem?.id), active: mode === "both" },
              ]}
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-full bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition hover:bg-[var(--brand-ink)]"
            >
              Refresh map
            </button>
          </div>
        </form>

        <div className={selectedCardClass}>
          <div className={selectedEyebrowClass}>Selected</div>
          <div className={selectedTitleClass}>{activeItem?.name ?? "No mapped result"}</div>
          {activeItem ? (
            <>
              <div className={selectedMetaClass}>
                {activeItem.type === "station" ? "Rail station" : activeItem.type === "bus_stop_group" ? "Bus station group" : "Bus stop"}
                {activeItem.type === "bus_stop_group" ? "" : ` · ${activeItem.localityName ?? activeItem.code}`}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={activeItem.boardHref}
                  className="inline-flex items-center rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition hover:bg-[var(--brand-ink)]"
                >
                  {activeItem.type === "station" ? "Open station board" : activeItem.type === "bus_stop_group" ? "Open bus station board" : "Open stop board"}
                </Link>
                <Link href={activeItem.focusHref} className={focusButtonClass}>
                  Keep focused
                </Link>
              </div>
            </>
          ) : (
            <p className={bodyClass}>Search for a location to populate the map and focus panel.</p>
          )}
        </div>

        <div>
          <div className={matchesEyebrowClass}>Matches</div>
          <div className="mt-2 space-y-3">
            {searchResult.error ? (
              <div className="rounded-[1.4rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{searchResult.error}</div>
            ) : mapItems.length === 0 ? (
              <div className={emptyClass}>No results with usable coordinates matched this search.</div>
            ) : (
              mapItems.slice(0, 8).map((item) => (
                <div key={item.id} className={resultCardClass}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className={resultTypeClass}>
                        {item.type === "station" ? "Rail station" : item.type === "bus_stop_group" ? "Bus station group" : "Bus stop"}
                      </div>
                      <div className={resultTitleClass}>{item.name}</div>
                      <div className={resultMetaClass}>
                        {[item.localityName, item.type === "bus_stop_group" ? null : item.code].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <Link href={item.focusHref} className={focusButtonClass}>
                      Focus
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <AppShell activePath="map">
      <PageHeader
        eyebrow="Network map"
        title="Explore stations and bus stops on the map"
        description="Find stations and stops near you."
      />

      <PanelCard eyebrow="Explore on map" title="Mapped search results" className="overflow-hidden">
        <div className="relative">
          <div className="h-[420px] bg-[var(--surface-soft)] sm:h-[520px] lg:h-[820px]">
            <MapCanvas items={mapItems} activeId={activeItem?.id ?? null} vehicleOperatorIds={vehicleOperatorIds} />
          </div>

          <div className="hidden xl:block absolute left-5 top-5 z-[700] max-h-[calc(100%-2.5rem)] w-[min(380px,calc(100%-2.5rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white/97 p-5 text-slate-900 shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-sm">
            {renderMapSheet("light")}
          </div>
        </div>
      </PanelCard>

      <div className="xl:hidden">
        <PanelCard eyebrow="Map controls" title="Search and focus mapped locations">
          {renderMapSheet("default")}
        </PanelCard>
      </div>
    </AppShell>
  );
}
