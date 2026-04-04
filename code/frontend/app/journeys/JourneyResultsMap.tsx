"use client";

import { useEffect, useRef } from "react";
import { JourneyPlanResponse } from "../lib/transportApi";
import { JourneyRoutePoint, JourneyRouteShape } from "./types";

type JourneyResultsMapProps = {
  itineraries: JourneyPlanResponse["itineraries"];
  routeShapes: JourneyRouteShape[];
  selectedIndex: number;
  onSelect: (index: number) => void;
};

const DEFAULT_CENTER: [number, number] = [54.047, -2.801];
const DEFAULT_ZOOM = 13;

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

export default function JourneyResultsMap({ itineraries, routeShapes, selectedIndex, onSelect }: JourneyResultsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerGroupRef = useRef<import("leaflet").LayerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initialise() {
      if (!containerRef.current || mapRef.current) return;

      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      layerGroupRef.current = L.layerGroup().addTo(map);
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      mapRef.current = map;
    }

    initialise();

    return () => {
      cancelled = true;
      layerGroupRef.current?.clearLayers();
      layerGroupRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
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
        map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        return;
      }

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

          L.polyline(latLngs, {
            color: isSelected ? "#0f172a" : "rgba(15,23,42,0.78)",
            weight: isSelected ? 10 : 8,
            opacity: isSelected ? 0.38 : 0.28,
            interactive: false,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(layerGroup);

          const routeLine = L.polyline(latLngs, {
            color: isSelected ? "#2f6df6" : "#ffffff",
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

      const bounds = L.latLngBounds(allPoints.map((point) => [point.latitude, point.longitude] as [number, number]));
      map.fitBounds(bounds.pad(0.14), { maxZoom: 15 });
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [itineraries, onSelect, routeShapes, selectedIndex]);

  const selectedItinerary = itineraries[selectedIndex] ?? null;
  const selectedPrimaryTransit = getPrimaryTransitLabel(selectedItinerary);

  return (
    <div className="relative">
      <div ref={containerRef} className="h-[520px] w-full overflow-hidden rounded-[2rem] bg-[var(--surface-soft)] xl:h-[780px]" />

      <div className="pointer-events-none absolute right-4 top-4 flex flex-wrap justify-end gap-2">
        <span className="rounded-full border border-black/10 bg-white/92 px-4 py-2 text-sm font-semibold text-slate-900 shadow-[0_14px_30px_rgba(15,23,42,0.12)]">
          {selectedItinerary ? `${selectedItinerary.totalMinutes} min` : "Route overview"}
        </span>
        <span className="rounded-full border border-black/10 bg-white/92 px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_14px_30px_rgba(15,23,42,0.12)]">
          {selectedPrimaryTransit}
        </span>
      </div>

      <div className="absolute bottom-4 right-4 max-w-[280px] rounded-[1.9rem] border border-black/10 bg-white/94 p-4 text-slate-900 shadow-[0_18px_36px_rgba(15,23,42,0.16)] backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Map details</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">Route comparison</div>
          </div>
          <div className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
            {itineraries.length} routes
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="h-3 w-3 rounded-full bg-[#2f6df6]" />
              Active route
            </div>
            <div className="mt-1 text-xs text-slate-600">Selected from the list or map</div>
          </div>
          <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="h-3 w-3 rounded-full bg-white ring-1 ring-slate-300" />
              Alternatives
            </div>
            <div className="mt-1 text-xs text-slate-600">Click a white route to promote it</div>
          </div>
          <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="h-0.5 w-5 rounded-full bg-slate-500" />
              Transit
            </div>
            <div className="mt-1 text-xs text-slate-600">Road-snapped corridor path</div>
          </div>
          <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="h-0.5 w-5 rounded-full border-b-2 border-dashed border-slate-500" />
              Walking
            </div>
            <div className="mt-1 text-xs text-slate-600">Pedestrian route geometry</div>
          </div>
        </div>
      </div>
    </div>
  );
}
