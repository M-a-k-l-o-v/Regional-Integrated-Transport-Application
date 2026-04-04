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
  }));

  const activeItem =
    mapItems.find((item) => item.id === focus || item.code === focus) ??
    mapItems[0] ??
    null;

  return (
    <AppShell activePath="map">
      <PageHeader
        eyebrow="Network map"
        title="Explore stations and bus stops on the map"
        description="This map uses OpenStreetMap tiles through Leaflet and plots the current backend search results with direct links into the scheduled departure boards."
      />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
        <PanelCard className="overflow-hidden p-0">
          <div className="border-b border-[var(--outline)] px-5 py-4">
            <form action="/map" className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex items-center gap-3 rounded-[1.6rem] border border-[var(--outline)] bg-[var(--input)] px-4 py-3 shadow-[var(--shadow-soft)]">
                <span className="text-lg text-[var(--brand)]">⌕</span>
                <input
                  type="text"
                  name="q"
                  defaultValue={q}
                  placeholder="Search area, station, or stop"
                  className="w-full bg-transparent text-base text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-full bg-[var(--brand)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition hover:bg-[var(--brand-ink)]"
              >
                Refresh map
              </button>
            </form>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <ModeTabs
                tabs={[
                  { label: "Rail", href: modeHref(effectiveQuery, "rail", activeItem?.id), active: mode === "rail" },
                  { label: "Bus", href: modeHref(effectiveQuery, "bus", activeItem?.id), active: mode === "bus" },
                  { label: "Both", href: modeHref(effectiveQuery, "both", activeItem?.id), active: mode === "both" },
                ]}
              />
              <div className="rounded-full border border-[var(--outline)] bg-[var(--surface-soft)] px-4 py-2 text-sm font-semibold text-[var(--brand-ink)] shadow-[var(--shadow-soft)]">
                {mapItems.length} mapped results
              </div>
            </div>
          </div>

          <div className="h-[620px] bg-[var(--surface-soft)] lg:h-[760px]">
            <MapCanvas items={mapItems} activeId={activeItem?.id ?? null} />
          </div>
        </PanelCard>

        <div className="space-y-6">
          <PanelCard eyebrow="Selected" title={activeItem?.name ?? "No mapped result"}>
            {activeItem ? (
              <div className="space-y-4">
                <div className="text-sm text-[var(--muted)]">
                  {activeItem.type === "station" ? "Rail station" : activeItem.type === "bus_stop_group" ? "Bus station group" : "Bus stop"}
                  {activeItem.type === "bus_stop_group" ? "" : ` · ${activeItem.code}`}
                </div>
                <Link
                  href={activeItem.boardHref}
                  className="inline-flex items-center rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition hover:bg-[var(--brand-ink)]"
                >
                  {activeItem.type === "station" ? "Open station board" : activeItem.type === "bus_stop_group" ? "Open bus station board" : "Open stop board"}
                </Link>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">Search for a location to populate the map and selected-result panel.</p>
            )}
          </PanelCard>

          <PanelCard eyebrow="Results" title={`Matches for “${effectiveQuery}”`}>
            {searchResult.error ? (
              <p className="text-sm text-rose-700">{searchResult.error}</p>
            ) : mapItems.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No results with usable coordinates matched this search.</p>
            ) : (
              <div className="space-y-3">
                {mapItems.slice(0, 8).map((item) => (
                  <div key={item.id} className="app-list-card">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                          {item.type === "station" ? "Rail station" : item.type === "bus_stop_group" ? "Bus station group" : "Bus stop"}
                        </div>
                        <div className="mt-1 text-lg font-semibold text-[var(--foreground)]">{item.name}</div>
                        <div className="mt-1 text-sm text-[var(--muted)]">
                          {[item.localityName, item.type === "bus_stop_group" ? null : item.code].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <Link
                        href={modeHref(effectiveQuery, mode, item.id)}
                        className="rounded-full bg-[var(--surface-accent)] px-4 py-2 text-sm font-semibold text-[var(--brand)] shadow-[var(--shadow-soft)]"
                      >
                        Focus
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PanelCard>
        </div>
      </div>
    </AppShell>
  );
}
