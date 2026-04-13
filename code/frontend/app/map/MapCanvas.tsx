"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BusLiveResponse, fetchJson } from "../lib/transportApi";

type MapItem = {
  id: string;
  type: "station" | "bus_stop" | "bus_stop_group";
  code: string;
  name: string;
  localityName?: string | null;
  latitude: number;
  longitude: number;
  boardHref: string;
  focusHref?: string;
};

type MapCanvasProps = {
  items: MapItem[];
  activeId: string | null;
  /** If provided, the map will poll /bus/live/:id for each operator every 15s */
  vehicleOperatorIds?: string[];
};

type MapStyle = "light" | "dark" | "satellite" | "terrain";

const DEFAULT_CENTER: [number, number] = [54.047, -2.801];
const DEFAULT_ZOOM = 13;
const VEHICLE_POLL_INTERVAL_MS = 15_000;

const MAP_STYLES: { key: MapStyle; label: string; icon: string }[] = [
  { key: "light", label: "Light", icon: "☀" },
  { key: "dark", label: "Dark", icon: "🌙" },
  { key: "satellite", label: "Satellite", icon: "🛰" },
  { key: "terrain", label: "Terrain", icon: "⛰" },
];

function getTileConfig(style: MapStyle): { url: string; attribution: string; maxZoom: number } {
  switch (style) {
    case "dark":
      return {
        url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
        maxZoom: 19,
      };
    case "satellite":
      return {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution: "&copy; Esri, Maxar, Earthstar Geographics",
        maxZoom: 18,
      };
    case "terrain":
      return {
        url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        attribution: "&copy; OpenStreetMap contributors, SRTM &copy; OpenTopoMap",
        maxZoom: 17,
      };
    default:
      return {
        url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
        maxZoom: 19,
      };
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const BUS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><rect x="4" y="3" width="16" height="14" rx="2"/><line x1="4" y1="11" x2="20" y2="11"/><circle cx="8" cy="19" r="1"/><circle cx="16" cy="19" r="1"/></svg>`;

export default function MapCanvas({ items, activeId, vehicleOperatorIds = [] }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const vehicleLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const tileLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const vehicleMarkersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const [mapReady, setMapReady] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyle>("light");
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);

  // ── Map initialisation ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function initialise() {
      if (!containerRef.current || mapRef.current) return;

      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
        zoomSnap: 0,
        zoomDelta: 1,
        wheelDebounceTime: 40,
        wheelPxPerZoomLevel: 60,
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
      });

      const config = getTileConfig("light");
      tileLayerRef.current = L.tileLayer(config.url, {
        attribution: config.attribution,
        maxZoom: config.maxZoom,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      markerLayerRef.current = L.layerGroup().addTo(map);
      vehicleLayerRef.current = L.layerGroup().addTo(map);
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      mapRef.current = map;
      if (!cancelled) setMapReady(true);
    }

    initialise();

    return () => {
      cancelled = true;
      markerLayerRef.current?.clearLayers();
      vehicleLayerRef.current?.clearLayers();
      markerLayerRef.current = null;
      vehicleLayerRef.current = null;
      vehicleMarkersRef.current.clear();
      tileLayerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // ── Tile layer swap ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const oldTile = tileLayerRef.current;
    if (!map || !oldTile) return;

    let cancelled = false;

    async function swap() {
      const L = await import("leaflet");
      if (cancelled || !map) return;

      const config = getTileConfig(mapStyle);
      if (oldTile) map.removeLayer(oldTile);
      tileLayerRef.current = L.tileLayer(config.url, {
        attribution: config.attribution,
        maxZoom: config.maxZoom,
      }).addTo(map);
    }

    swap();
    return () => { cancelled = true; };
  }, [mapStyle]);

  // ── Stop / station markers ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    let cancelled = false;

    async function renderMarkers() {
      const map = mapRef.current;
      const markerLayer = markerLayerRef.current;
      if (!map || !markerLayer) return;

      const L = await import("leaflet");
      if (cancelled) return;

      markerLayer.clearLayers();

      if (items.length === 0) {
        map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        return;
      }

      const bounds = L.latLngBounds(items.map((item) => [item.latitude, item.longitude] as [number, number]));

      for (const item of items) {
        const isActive = item.id === activeId;
        const icon = L.divIcon({
          className: "",
          html: `<div class="app-map-marker ${isActive ? "app-map-marker--active" : ""}">${item.type === "station" ? "R" : "B"}</div>`,
          iconSize: isActive ? [34, 34] : [28, 28],
          iconAnchor: isActive ? [17, 17] : [14, 14],
          popupAnchor: [0, -16],
        });

        const marker = L.marker([item.latitude, item.longitude], { icon }).addTo(markerLayer);
        marker.bindPopup(
          `<div class="app-map-popup">
            <div class="app-map-popup__eyebrow">${item.type === "station" ? "Rail station" : item.type === "bus_stop_group" ? "Bus station group" : "Bus stop"}</div>
            <div class="app-map-popup__title">${escapeHtml(item.name)}</div>
            <div class="app-map-popup__code">${escapeHtml(item.localityName ?? (item.type === "bus_stop_group" ? "Grouped hub" : item.code))}</div>
            <div class="app-map-popup__actions">
              ${item.focusHref ? `<a class="app-map-popup__link app-map-popup__link--secondary" href="${item.focusHref}">Focus</a>` : ""}
              <a class="app-map-popup__link" href="${item.boardHref}">${item.type === "station" ? "Open station board" : item.type === "bus_stop_group" ? "Open bus station board" : "Open stop board"}</a>
            </div>
          </div>`
        );

        if (isActive) {
          marker.openPopup();
          marker.bindTooltip(escapeHtml(item.name), {
            permanent: true,
            direction: "right",
            offset: [12, 0],
            className: "journey-map-point-label",
          });
        }
      }

      if (items.length === 1) {
        const [only] = items;
        map.flyTo([only.latitude, only.longitude], 15, { duration: 0.8 });
        return;
      }

      map.flyToBounds(bounds.pad(0.18), { maxZoom: 15, duration: 0.8 });
    }

    renderMarkers();
    return () => { cancelled = true; };
  }, [mapReady, items, activeId]);

  // ── Live vehicle markers — smooth animated ─────────────────────────────────
  const renderVehicles = useCallback(async (vehicles: BusLiveResponse["vehicles"]) => {
    const map = mapRef.current;
    const vehicleLayer = vehicleLayerRef.current;
    if (!map || !vehicleLayer) return;

    const L = await import("leaflet");

    const currentKeys = new Set<string>();

    for (const v of vehicles) {
      if (v.latitude === null || v.longitude === null) continue;

      const bearing = v.bearing ?? 0;
      const lineLabel = (v.publishedLineName ?? v.lineRef ?? "").trim() || "?";
      const vKey = v.vehicleRef ?? `${lineLabel}-${v.latitude.toFixed(3)}`;
      currentKeys.add(vKey);

      const iconHtml = `<div class="live-bus-marker" style="--delay-color:#f59e0b;--bearing:${bearing}deg">
        <div class="live-bus-marker__body">
          <div class="live-bus-marker__icon">${BUS_SVG}</div>
        </div>
        <div class="live-bus-marker__bearing"></div>
        <div class="live-bus-marker__label">${escapeHtml(lineLabel)}</div>
      </div>`;

      const popupContent = `<div class="app-map-popup">
        <div class="app-map-popup__eyebrow">Live bus · ${escapeHtml(v.operatorRef ?? "")}</div>
        <div class="app-map-popup__title">Service ${escapeHtml(lineLabel)}</div>
        <div class="app-map-popup__code">${escapeHtml(v.destinationName ?? "Destination unknown")}${v.monitored ? " · monitored" : ""}</div>
      </div>`;

      const existing = vehicleMarkersRef.current.get(vKey);
      if (existing) {
        const newLatLng = L.latLng(v.latitude, v.longitude);
        const currentLatLng = existing.getLatLng();
        const distance = currentLatLng.distanceTo(newLatLng);

        if (distance > 5 && distance < 5000) {
          animateMarker(existing, newLatLng, 1200);
        } else if (distance >= 5000) {
          existing.setLatLng(newLatLng);
        }

        existing.setIcon(L.divIcon({
          className: "",
          html: iconHtml,
          iconSize: [48, 48],
          iconAnchor: [24, 24],
          popupAnchor: [0, -24],
        }));
        existing.setPopupContent(popupContent);
      } else {
        const icon = L.divIcon({
          className: "",
          html: iconHtml,
          iconSize: [48, 48],
          iconAnchor: [24, 24],
          popupAnchor: [0, -24],
        });

        const marker = L.marker([v.latitude, v.longitude], { icon }).addTo(vehicleLayer);
        marker.bindPopup(popupContent);
        vehicleMarkersRef.current.set(vKey, marker);
      }
    }

    // Remove markers no longer present
    for (const [key, marker] of vehicleMarkersRef.current) {
      if (!currentKeys.has(key)) {
        vehicleLayer.removeLayer(marker);
        vehicleMarkersRef.current.delete(key);
      }
    }
  }, []);

  function animateMarker(marker: import("leaflet").Marker, target: import("leaflet").LatLng, durationMs: number) {
    const start = marker.getLatLng();
    const startTime = performance.now();

    function step(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);

      const lat = start.lat + (target.lat - start.lat) * eased;
      const lng = start.lng + (target.lng - start.lng) * eased;
      marker.setLatLng([lat, lng]);

      if (t < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }

  useEffect(() => {
    if (!mapReady || vehicleOperatorIds.length === 0) return;

    let cancelled = false;

    async function fetchAndRender() {
      if (cancelled) return;
      const allVehicles: BusLiveResponse["vehicles"] = [];
      await Promise.all(
        vehicleOperatorIds.map(async (id) => {
          const { data } = await fetchJson<BusLiveResponse>(`/bus/live/${encodeURIComponent(id)}`);
          if (data) allVehicles.push(...data.vehicles);
        })
      );
      if (!cancelled) await renderVehicles(allVehicles);
    }

    fetchAndRender();

    const intervalId = setInterval(fetchAndRender, VEHICLE_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
      vehicleMarkersRef.current.clear();
      vehicleLayerRef.current?.clearLayers();
    };
  }, [mapReady, vehicleOperatorIds, renderVehicles]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* Map style switcher */}
      <div className="absolute left-3 top-3 z-[600]">
        <button
          type="button"
          onClick={() => setStyleMenuOpen((prev) => !prev)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white/95 text-base shadow-[0_4px_16px_rgba(0,0,0,0.1)] backdrop-blur-sm transition hover:bg-white"
          title="Change map style"
        >
          <svg className="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </button>

        {styleMenuOpen ? (
          <div className="absolute left-0 top-12 w-40 overflow-hidden rounded-xl border border-black/10 bg-white/97 shadow-[0_8px_32px_rgba(0,0,0,0.14)] backdrop-blur-sm">
            {MAP_STYLES.map((style) => (
              <button
                key={style.key}
                type="button"
                onClick={() => { setMapStyle(style.key); setStyleMenuOpen(false); }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition hover:bg-slate-50 ${
                  mapStyle === style.key ? "bg-slate-50 font-semibold text-slate-900" : "text-slate-600"
                }`}
              >
                <span className="text-base">{style.icon}</span>
                {style.label}
                {mapStyle === style.key ? (
                  <svg className="ml-auto h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
