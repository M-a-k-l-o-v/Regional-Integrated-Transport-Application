"use client";

import { useEffect, useRef, useState } from "react";
import { JourneyLegDetailResponse } from "../../lib/transportApi";
import { JourneyRoutePoint } from "../types";

type LegRouteMapProps = {
  points: JourneyLegDetailResponse["path"]["points"];
  geometryPoints?: JourneyRoutePoint[];
  mode: "bus" | "rail";
  routeTitle: string;
  durationLabel: string;
  operator: string | null;
  mappedPointCount: number;
  totalPointCount: number;
};

const DEFAULT_CENTER: [number, number] = [54.047, -2.801];
const DEFAULT_ZOOM = 13;

function getMidPoint(points: Array<{ latitude: number; longitude: number }>) {
  if (points.length === 0) return null;
  return points[Math.floor(points.length / 2)] ?? null;
}

export default function LegRouteMap({
  points,
  geometryPoints = [],
  mode,
  routeTitle,
  durationLabel,
  operator,
  mappedPointCount,
  totalPointCount,
}: LegRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerGroupRef = useRef<import("leaflet").LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);

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

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      layerGroupRef.current = L.layerGroup().addTo(map);
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      mapRef.current = map;
      if (!cancelled) setMapReady(true);
    }

    initialise();

    return () => {
      cancelled = true;
      layerGroupRef.current?.clearLayers();
      layerGroupRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

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

      const mappedPoints = points.filter(
        (point): point is typeof point & { latitude: number; longitude: number } =>
          point.latitude !== null && point.longitude !== null
      );

      if (mappedPoints.length === 0) {
        map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        return;
      }

      const routePoints =
        geometryPoints.length >= 2
          ? geometryPoints
          : mappedPoints.map((point) => ({ latitude: point.latitude, longitude: point.longitude }));
      const latLngs = routePoints.map((point) => [point.latitude, point.longitude] as [number, number]);
      const routeColor = mode === "bus" ? "#f59e0b" : "#dc2626";
      L.polyline(latLngs, {
        color: "rgba(15,23,42,0.34)",
        weight: 10,
        opacity: 0.5,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(layerGroup);
      L.polyline(latLngs, {
        color: routeColor,
        weight: 6,
        opacity: 0.96,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(layerGroup);

      const midPoint = getMidPoint(routePoints);
      if (midPoint) {
        L.marker([midPoint.latitude, midPoint.longitude], {
          interactive: false,
          icon: L.divIcon({
            className: "journey-route-duration-wrapper",
            html: `<div class="journey-route-duration journey-route-duration--active">${durationLabel}</div>`,
          }),
        }).addTo(layerGroup);
      }

      mappedPoints.forEach((point, index) => {
        const marker = L.circleMarker([point.latitude, point.longitude], {
          radius: index === 0 || index === mappedPoints.length - 1 ? 7 : 5,
          color: "#ffffff",
          weight: 2,
          fillColor: index === 0 ? "#0f6b3a" : index === mappedPoints.length - 1 ? "#ef4444" : routeColor,
          fillOpacity: 1,
        }).addTo(layerGroup);

        marker.bindPopup(
          `<div class="app-map-popup">
            <div class="app-map-popup__eyebrow">${index === 0 ? "Start" : index === mappedPoints.length - 1 ? "End" : "Intermediate stop"}</div>
            <div class="app-map-popup__title">${point.name}</div>
            <div class="app-map-popup__code">${point.localityName ?? point.code}</div>
          </div>`
        );
      });

      const startPoint = mappedPoints[0] ?? null;
      const endPoint = mappedPoints[mappedPoints.length - 1] ?? null;
      if (startPoint) {
        L.circleMarker([startPoint.latitude, startPoint.longitude], {
          radius: 8,
          color: "#ffffff",
          weight: 2,
          fillColor: "#0f6b3a",
          fillOpacity: 1,
        })
          .addTo(layerGroup)
          .bindTooltip(startPoint.name, {
            permanent: true,
            direction: "right",
            offset: [12, 0],
            className: "journey-map-point-label",
          });
      }
      if (endPoint) {
        L.circleMarker([endPoint.latitude, endPoint.longitude], {
          radius: 8,
          color: "#ffffff",
          weight: 2,
          fillColor: "#ef4444",
          fillOpacity: 1,
        })
          .addTo(layerGroup)
          .bindTooltip(endPoint.name, {
            permanent: true,
            direction: "left",
            offset: [-12, 0],
            className: "journey-map-point-label",
          });
      }

      if (mappedPoints.length === 1) {
        map.flyTo(latLngs[0], 15, { duration: 0.8 });
        return;
      }

      const bounds = L.latLngBounds(latLngs);
      map.flyToBounds(bounds.pad(0.18), { maxZoom: 15, duration: 0.8 });
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [mapReady, geometryPoints, mappedPointCount, mode, operator, points, routeTitle, totalPointCount, durationLabel]);

  return (
    <>
    <div className="relative z-0 isolate">
      <div ref={containerRef} className="h-[340px] w-full overflow-hidden rounded-[1.5rem] bg-[var(--surface-soft)] sm:h-[420px] sm:rounded-[2rem] lg:h-[620px]" />

      <div className="pointer-events-none absolute right-3 top-3 flex flex-wrap justify-end gap-2 sm:right-4 sm:top-4">
        <span className="rounded-full border border-black/10 bg-white/92 px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-[0_14px_30px_rgba(15,23,42,0.12)] sm:px-4 sm:py-2 sm:text-sm">
          {durationLabel}
        </span>
        <span className="rounded-full border border-black/10 bg-white/92 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-[0_14px_30px_rgba(15,23,42,0.12)] sm:px-4 sm:py-2 sm:text-sm">
          {routeTitle}
        </span>
      </div>

      {/* Info overlay: hidden on xs so it doesn't cover most of the map */}
      <div className="hidden sm:block absolute bottom-4 right-4 max-w-[260px] rounded-[1.9rem] border border-black/10 bg-white/94 p-4 text-slate-900 shadow-[0_18px_36px_rgba(15,23,42,0.16)] backdrop-blur-sm lg:max-w-[280px]">
        <div className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Map details</div>
        <div className="mt-1 text-2xl font-semibold text-slate-900">
          {mode === "bus" ? "Service path" : "Rail path"}
        </div>
        <div className="mt-2 text-sm text-slate-600">
          {operator ?? "Operator unknown"} · {mappedPointCount}/{totalPointCount} mapped points
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className={`h-3 w-3 rounded-full ${mode === "bus" ? "bg-[#f59e0b]" : "bg-[#dc2626]"}`} />
              Main path
            </div>
            <div className="mt-1 text-xs text-slate-600">Refined map geometry</div>
          </div>
          <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="h-3 w-3 rounded-full bg-emerald-700" />
              Start / end
            </div>
            <div className="mt-1 text-xs text-slate-600">Permanent endpoint labels</div>
          </div>
        </div>
      </div>
    </div>

    {/* Compact legend shown below the map on xs screens */}
    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[var(--muted)] sm:hidden">
      <span className="flex items-center gap-1.5 font-medium">
        <span className={`h-2.5 w-2.5 rounded-full ${mode === "bus" ? "bg-[#f59e0b]" : "bg-[#dc2626]"}`} />
        {mode === "bus" ? "Bus path" : "Rail path"}
      </span>
      <span className="flex items-center gap-1.5 font-medium">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-700" />
        Start
      </span>
      <span className="flex items-center gap-1.5 font-medium">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
        End
      </span>
      <span className="ml-auto text-xs">{mappedPointCount}/{totalPointCount} mapped</span>
    </div>
    </>
  );
}
