"use client";

import { useEffect, useRef, useState } from "react";
import { VmsSign } from "../lib/transportApi";

type VmsMapProps = {
  signs: VmsSign[];
  selectedId: string | null;
  onSelectSign: (id: string | null) => void;
};

const DEFAULT_CENTER: [number, number] = [53.88, -2.73];
const DEFAULT_ZOOM = 10;

export default function VmsMap({ signs, selectedId, onSelectSign }: VmsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const tileLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
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
      });

      tileLayerRef.current = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      mapRef.current = map;
      if (!cancelled) setMapReady(true);
    }

    init();

    return () => {
      cancelled = true;
      layerRef.current?.clearLayers();
      layerRef.current = null;
      tileLayerRef.current = null;
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
      const layer = layerRef.current;
      if (!map || !layer) return;

      const L = await import("leaflet");
      if (cancelled) return;

      layer.clearLayers();

      const mappedSigns = signs.filter((s) => s.latitude !== null && s.longitude !== null);
      if (mappedSigns.length === 0) {
        map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        return;
      }

      // Draw the M6 corridor line through the sign positions
      const sortedByLat = [...mappedSigns].sort((a, b) => (a.latitude ?? 0) - (b.latitude ?? 0));
      const corridorLatLngs = sortedByLat.map((s) => [s.latitude!, s.longitude!] as [number, number]);
      L.polyline(corridorLatLngs, {
        color: "#64748b",
        weight: 3,
        opacity: 0.35,
        dashArray: "8 6",
        lineCap: "round",
      }).addTo(layer);

      for (const sign of mappedSigns) {
        const isActive = sign.id === selectedId;
        const hasMessage = !sign.isBlank;

        const icon = L.divIcon({
          className: "",
          html: `<div class="vms-map-marker ${isActive ? "vms-map-marker--active" : ""} ${hasMessage ? "vms-map-marker--message" : "vms-map-marker--blank"}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
              <rect x="2" y="4" width="20" height="12" rx="2"/>
              <line x1="6" y1="8" x2="18" y2="8"/>
              <line x1="6" y1="12" x2="14" y2="12"/>
            </svg>
          </div>`,
          iconSize: isActive ? [36, 36] : [30, 30],
          iconAnchor: isActive ? [18, 18] : [15, 15],
          popupAnchor: [0, -16],
        });

        const marker = L.marker([sign.latitude!, sign.longitude!], { icon }).addTo(layer);

        const popupHtml = `<div class="app-map-popup">
          <div class="app-map-popup__eyebrow">${sign.direction ?? "VMS"} · ${sign.junction ?? sign.road}</div>
          <div class="app-map-popup__title">${sign.description}</div>
          <div class="app-map-popup__code">${hasMessage ? sign.messageLines.join("<br>") : "No message displayed"}</div>
        </div>`;

        marker.bindPopup(popupHtml);
        marker.on("click", () => onSelectSign(sign.id));

        if (isActive) {
          marker.openPopup();
        }
      }

      const bounds = L.latLngBounds(corridorLatLngs);
      map.flyToBounds(bounds.pad(0.15), { maxZoom: 12, duration: 0.8 });
    }

    render();
    return () => { cancelled = true; };
  }, [mapReady, signs, selectedId, onSelectSign]);

  return (
    <div className="relative z-0 isolate">
      <div ref={containerRef} className="h-[300px] w-full overflow-hidden rounded-[1.5rem] bg-[var(--surface-soft)] sm:h-[380px] sm:rounded-[2rem] lg:h-[480px]" />
      <div className="pointer-events-none absolute left-3 top-3 sm:left-4 sm:top-4">
        <span className="rounded-full border border-black/10 bg-white/92 px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-[0_14px_30px_rgba(15,23,42,0.12)] sm:px-4 sm:py-2 sm:text-sm">
          M6 Corridor · Lancashire
        </span>
      </div>
    </div>
  );
}
