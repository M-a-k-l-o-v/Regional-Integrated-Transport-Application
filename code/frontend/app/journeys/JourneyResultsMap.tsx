"use client";

import { useEffect, useRef, useState } from "react";
import { JourneyPlanResponse } from "../lib/transportApi";
import { LiveTrackingState } from "./LiveVehicleTracker";
import { JourneyRoutePoint, JourneyRouteShape } from "./types";

type JourneyResultsMapProps = {
  itineraries: JourneyPlanResponse["itineraries"];
  routeShapes: JourneyRouteShape[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  liveTracking?: LiveTrackingState | null;
};

const DEFAULT_CENTER: [number, number] = [54.047, -2.801];
const DEFAULT_ZOOM = 13;

// ── Tile layer definitions ──────────────────────────────────────────────────
type MapStyle = "light" | "dark" | "satellite" | "terrain";

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function getFirstPoint(shape: JourneyRouteShape): JourneyRoutePoint | null {
  for (const segment of shape.segments) {
    if (segment.points.length > 0) return segment.points[0];
  }
  return null;
}

function getLastPoint(shape: JourneyRouteShape): JourneyRoutePoint | null {
  for (let segmentIndex = shape.segments.length - 1; segmentIndex >= 0; segmentIndex -= 1) {
    const segment = shape.segments[segmentIndex];
    if (segment.points.length > 0) {
      return segment.points[segment.points.length - 1];
    }
  }
  return null;
}

function getMidPoint(shape: JourneyRouteShape): JourneyRoutePoint | null {
  const points = shape.segments.flatMap((segment) => segment.points);
  if (points.length === 0) return null;
  return points[Math.floor(points.length / 2)] ?? null;
}

function formatTooltip(itinerary: JourneyPlanResponse["itineraries"][number] | undefined, index: number): string {
  if (!itinerary) return `Route ${index + 1}`;
  const departure = new Date(itinerary.departureTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const arrival = new Date(itinerary.arrivalTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${departure} to ${arrival} · ${itinerary.totalMinutes} min`;
}

function getPrimaryTransitLabel(itinerary: JourneyPlanResponse["itineraries"][number] | null): string {
  if (!itinerary) return "No service";
  const transitLeg = itinerary.legs.find((leg) => leg.mode !== "walk");
  if (!transitLeg) return "Walking route";
  if (transitLeg.mode === "bus") return transitLeg.line ? `Service ${transitLeg.line}` : "Bus";
  return transitLeg.line ? `Train ${transitLeg.line}` : "Rail";
}

function getDelayColor(delayMinutes: number | null): string {
  if (delayMinutes === null) return "#6b7280";
  if (delayMinutes <= 1) return "#10b981";
  if (delayMinutes <= 5) return "#f59e0b";
  return "#ef4444";
}

function getDelayLabel(delayMinutes: number | null): string {
  if (delayMinutes === null) return "";
  if (delayMinutes <= 1) return "On time";
  return `+${delayMinutes}m`;
}

// Bus SVG icon as inline data URI — clean minimal bus shape
const BUS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><rect x="4" y="3" width="16" height="14" rx="2"/><line x1="4" y1="11" x2="20" y2="11"/><circle cx="8" cy="19" r="1"/><circle cx="16" cy="19" r="1"/></svg>`;

export default function JourneyResultsMap({ itineraries, routeShapes, selectedIndex, onSelect, liveTracking }: JourneyResultsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerGroupRef = useRef<import("leaflet").LayerGroup | null>(null);
  const vehicleLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const tileLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const vehicleMarkersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const [mapReady, setMapReady] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyle>("light");
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);

  // ── Map init ────────────────────────────────────────────────────────────
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
      layerGroupRef.current = L.layerGroup().addTo(map);
      vehicleLayerRef.current = L.layerGroup().addTo(map);
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      mapRef.current = map;
      if (!cancelled) setMapReady(true);
    }

    initialise();

    return () => {
      cancelled = true;
      layerGroupRef.current?.clearLayers();
      layerGroupRef.current = null;
      vehicleLayerRef.current?.clearLayers();
      vehicleLayerRef.current = null;
      vehicleMarkersRef.current.clear();
      tileLayerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // ── Tile layer swap ─────────────────────────────────────────────────────
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

  // ── Route rendering ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    let cancelled = false;

    async function render() {
      const map = mapRef.current;
      const layerGroup = layerGroupRef.current;
      if (!map || !layerGroup) return;

      const L = await import("leaflet");
      if (cancelled) return;

      layerGroup.clearLayers();

      const allPoints = routeShapes.flatMap((shape) => shape.segments.flatMap((segment) => segment.points));
      if (allPoints.length === 0) {
        map.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, { duration: 0.8 });
        return;
      }

      const isDark = mapStyle === "dark" || mapStyle === "satellite";

      const drawOrder = routeShapes.map((_, index) => index).sort((left, right) => {
        if (left === selectedIndex) return 1;
        if (right === selectedIndex) return -1;
        return left - right;
      });

      drawOrder.forEach((itineraryIndex) => {
        const shape = routeShapes[itineraryIndex];
        const isSelected = itineraryIndex === selectedIndex;
        const tooltip = formatTooltip(itineraries[itineraryIndex], itineraryIndex);

        shape.segments.forEach((segment) => {
          if (segment.points.length < 2) return;
          const latLngs = segment.points.map((point) => [point.latitude, point.longitude] as [number, number]);

          // Shadow line
          L.polyline(latLngs, {
            color: isDark ? "rgba(0,0,0,0.6)" : isSelected ? "#0f172a" : "rgba(15,23,42,0.78)",
            weight: isSelected ? 10 : 8,
            opacity: isSelected ? 0.38 : 0.28,
            interactive: false,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(layerGroup);

          // Route line — color by mode: bus=blue, rail=red, walk=grey
          const segmentColor = !isSelected
            ? isDark ? "rgba(255,255,255,0.85)" : "#ffffff"
            : segment.mode === "rail" ? "#dc2626"
            : segment.mode === "bus" ? "#2f6df6"
            : "#94a3b8";
          const routeLine = L.polyline(latLngs, {
            color: segmentColor,
            weight: isSelected ? (segment.mode === "walk" ? 5 : 6) : segment.mode === "walk" ? 3 : 4,
            opacity: isSelected ? 0.96 : 0.88,
            dashArray: segment.mode === "walk" ? "10 10" : undefined,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(layerGroup);

          routeLine.on("click", () => onSelect(itineraryIndex));
          routeLine.bindTooltip(tooltip, { sticky: true, direction: "top" });
        });

        const midPoint = getMidPoint(shape);
        const itinerary = itineraries[itineraryIndex];
        if (midPoint && itinerary) {
          const durationMarker = L.marker([midPoint.latitude, midPoint.longitude], {
            interactive: true,
            icon: L.divIcon({
              className: "journey-route-duration-wrapper",
              html: `<div class="journey-route-duration${isSelected ? " journey-route-duration--active" : ""}">${itinerary.totalMinutes} min</div>`,
            }),
          }).addTo(layerGroup);
          durationMarker.on("click", () => onSelect(itineraryIndex));
        }
      });

      const selectedShape = routeShapes[selectedIndex] ?? routeShapes[0] ?? null;
      const selectedItinerary = itineraries[selectedIndex] ?? itineraries[0] ?? null;
      const startPoint = selectedShape ? getFirstPoint(selectedShape) : null;
      const endPoint = selectedShape ? getLastPoint(selectedShape) : null;

      if (startPoint) {
        const startMarker = L.circleMarker([startPoint.latitude, startPoint.longitude], {
          radius: 8,
          color: "#ffffff",
          weight: 2,
          fillColor: "#0f6b3a",
          fillOpacity: 1,
        }).addTo(layerGroup);
        const label = selectedItinerary?.legs[0]?.from.name;
        if (label) {
          startMarker.bindTooltip(label, {
            permanent: true,
            direction: "right",
            offset: [12, 0],
            className: "journey-map-point-label",
          });
        }
      }

      if (endPoint) {
        const endMarker = L.circleMarker([endPoint.latitude, endPoint.longitude], {
          radius: 8,
          color: "#ffffff",
          weight: 2,
          fillColor: "#ef4444",
          fillOpacity: 1,
        }).addTo(layerGroup);
        const label = selectedItinerary?.legs[selectedItinerary.legs.length - 1]?.to.name;
        if (label) {
          endMarker.bindTooltip(label, {
            permanent: true,
            direction: "left",
            offset: [-12, 0],
            className: "journey-map-point-label",
          });
        }
      }

      // Center on the selected route, not all routes
      const selectedPoints = selectedShape
        ? selectedShape.segments.flatMap((seg) => seg.points)
        : allPoints;
      const focusPoints = selectedPoints.length > 0 ? selectedPoints : allPoints;
      const bounds = L.latLngBounds(focusPoints.map((point) => [point.latitude, point.longitude] as [number, number]));
      map.flyToBounds(bounds.pad(0.18), { maxZoom: 15, duration: 0.8 });
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [mapReady, itineraries, onSelect, routeShapes, selectedIndex, mapStyle]);

  // ── Live vehicle markers — smooth animated positions ───────────────────
  useEffect(() => {
    let cancelled = false;

    async function renderVehicles() {
      const map = mapRef.current;
      const vehicleLayer = vehicleLayerRef.current;
      if (!map || !vehicleLayer) return;

      const L = await import("leaflet");
      if (cancelled) return;

      const currentVehicles = liveTracking?.vehicles ?? [];
      const currentKeys = new Set<string>();

      for (const v of currentVehicles) {
        const vKey = v.vehicleRef ?? `${v.lineLabel}-${v.latitude.toFixed(4)}-${v.longitude.toFixed(4)}`;
        currentKeys.add(vKey);

        const delayColor = getDelayColor(v.delayMinutes);
        const delayLabel = getDelayLabel(v.delayMinutes);
        const bearing = v.bearing ?? 0;

        const iconHtml = `<div class="live-bus-marker" style="--delay-color:${delayColor};--bearing:${bearing}deg">
          <div class="live-bus-marker__body">
            <div class="live-bus-marker__icon">${BUS_SVG}</div>
          </div>
          <div class="live-bus-marker__bearing"></div>
          <div class="live-bus-marker__label">${v.lineLabel}</div>
        </div>`;

        const popupLines = [
          `<div style="min-width:180px">`,
          `<div style="font-size:0.7rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#888">Live bus · ${v.lineLabel}</div>`,
          `<div style="margin-top:4px;font-size:0.95rem;font-weight:700">${v.destinationName ?? "In service"}</div>`,
          delayLabel ? `<div style="margin-top:4px;font-size:0.82rem;color:${delayColor};font-weight:600">${delayLabel}</div>` : "",
          v.nearestStopName ? `<div style="margin-top:4px;font-size:0.82rem;color:#666">Near ${v.nearestStopName}</div>` : "",
          v.nextStopName ? `<div style="font-size:0.82rem;color:#666">Next: ${v.nextStopName}</div>` : "",
          `</div>`,
        ].join("");

        const existing = vehicleMarkersRef.current.get(vKey);
        if (existing) {
          // Smoothly animate to new position
          const newLatLng = L.latLng(v.latitude, v.longitude);
          const currentLatLng = existing.getLatLng();
          const distance = currentLatLng.distanceTo(newLatLng);

          // Only animate if moved but not teleported (< 5km)
          if (distance > 5 && distance < 5000) {
            animateMarker(existing, newLatLng, 1200);
          } else if (distance >= 5000) {
            existing.setLatLng(newLatLng);
          }

          // Update icon (bearing/delay may have changed)
          existing.setIcon(L.divIcon({
            className: "",
            html: iconHtml,
            iconSize: [48, 48],
            iconAnchor: [24, 24],
            popupAnchor: [0, -24],
          }));
          existing.setPopupContent(popupLines);
        } else {
          // New vehicle — create marker
          const icon = L.divIcon({
            className: "",
            html: iconHtml,
            iconSize: [48, 48],
            iconAnchor: [24, 24],
            popupAnchor: [0, -24],
          });

          const marker = L.marker([v.latitude, v.longitude], { icon, zIndexOffset: 1000 }).addTo(vehicleLayer);
          marker.bindPopup(popupLines);
          vehicleMarkersRef.current.set(vKey, marker);
        }
      }

      // Remove markers for vehicles no longer tracked
      for (const [key, marker] of vehicleMarkersRef.current) {
        if (!currentKeys.has(key)) {
          vehicleLayer.removeLayer(marker);
          vehicleMarkersRef.current.delete(key);
        }
      }
    }

    function animateMarker(marker: import("leaflet").Marker, target: import("leaflet").LatLng, durationMs: number) {
      const start = marker.getLatLng();
      const startTime = performance.now();

      function step(now: number) {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / durationMs);
        // Ease-out cubic
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

    renderVehicles();
    return () => {
      cancelled = true;
    };
  }, [liveTracking]);

  const selectedItinerary = itineraries[selectedIndex] ?? null;
  const selectedPrimaryTransit = getPrimaryTransitLabel(selectedItinerary);

  return (
    <div className="relative z-0 isolate">
      <div ref={containerRef} className="h-[520px] w-full overflow-hidden rounded-2xl bg-[var(--surface-soft)] xl:h-[780px]" />

      {/* Top-right info badges */}
      <div className="pointer-events-none absolute right-4 top-4 flex flex-wrap justify-end gap-2">
        <span className="rounded-full border border-black/10 bg-white/95 px-3 py-1.5 text-sm font-semibold text-slate-900 shadow-[0_4px_16px_rgba(0,0,0,0.1)]">
          {selectedItinerary ? `${selectedItinerary.totalMinutes} min` : "Route overview"}
        </span>
        <span className="rounded-full border border-black/10 bg-white/95 px-3 py-1.5 text-sm font-medium text-slate-600 shadow-[0_4px_16px_rgba(0,0,0,0.1)]">
          {selectedPrimaryTransit}
        </span>
        {liveTracking && liveTracking.vehicles.length > 0 ? (
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/95 px-3 py-1.5 text-sm font-semibold text-emerald-700 shadow-[0_4px_16px_rgba(0,0,0,0.1)]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            {liveTracking.vehicles.length} live
          </span>
        ) : null}
      </div>

      {/* Map style switcher — top-left */}
      <div className="absolute left-4 top-4 z-[600]">
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

      {/* Legend — bottom-right */}
      <div className="absolute bottom-4 right-4 max-w-[260px] rounded-2xl border border-black/10 bg-white/95 p-3.5 text-slate-900 shadow-[0_8px_24px_rgba(0,0,0,0.12)] backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-bold text-slate-900">Map legend</div>
          <div className="text-xs text-slate-500">{itineraries.length} routes</div>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full bg-[#2f6df6]" />
            Bus
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full bg-[#dc2626]" />
            Rail
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <span className="h-2.5 w-2.5 rounded-full bg-white ring-1 ring-slate-300" />
            Alternatives
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <span className="h-0.5 w-4 rounded-full border-b-2 border-dashed border-slate-400" />
            Walking
          </div>
        </div>
      </div>
    </div>
  );
}
