"use client";

import { useEffect, useRef } from "react";

type MapItem = {
  id: string;
  type: "station" | "bus_stop" | "bus_stop_group";
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  boardHref: string;
};

type MapCanvasProps = {
  items: MapItem[];
  activeId: string | null;
};

const DEFAULT_CENTER: [number, number] = [54.047, -2.801];
const DEFAULT_ZOOM = 13;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function MapCanvas({ items, activeId }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerLayerRef = useRef<import("leaflet").LayerGroup | null>(null);

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

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      markerLayerRef.current = L.layerGroup().addTo(map);
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      mapRef.current = map;
    }

    initialise();

    return () => {
      cancelled = true;
      markerLayerRef.current?.clearLayers();
      markerLayerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
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
            ${item.type === "bus_stop_group" ? "" : `<div class="app-map-popup__code">${escapeHtml(item.code)}</div>`}
            <a class="app-map-popup__link" href="${item.boardHref}">${item.type === "station" ? "Open station board" : item.type === "bus_stop_group" ? "Open bus station board" : "Open stop board"}</a>
          </div>`
        );

        if (isActive) {
          marker.openPopup();
        }
      }

      if (items.length === 1) {
        const [only] = items;
        map.setView([only.latitude, only.longitude], 15);
        return;
      }

      map.fitBounds(bounds.pad(0.18), { maxZoom: 15 });
    }

    renderMarkers();

    return () => {
      cancelled = true;
    };
  }, [items, activeId]);

  return <div ref={containerRef} className="h-full w-full" />;
}
