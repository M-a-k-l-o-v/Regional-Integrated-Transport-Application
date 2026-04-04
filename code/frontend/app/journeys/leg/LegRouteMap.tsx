"use client";

import { useEffect, useRef } from "react";
import { JourneyLegDetailResponse } from "../../lib/transportApi";

type LegRouteMapProps = {
  points: JourneyLegDetailResponse["path"]["points"];
};

const DEFAULT_CENTER: [number, number] = [54.047, -2.801];
const DEFAULT_ZOOM = 13;

export default function LegRouteMap({ points }: LegRouteMapProps) {
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

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
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

      const mappedPoints = points.filter(
        (point): point is typeof point & { latitude: number; longitude: number } =>
          point.latitude !== null && point.longitude !== null
      );

      if (mappedPoints.length === 0) {
        map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        return;
      }

      const latLngs = mappedPoints.map((point) => [point.latitude, point.longitude] as [number, number]);
      L.polyline(latLngs, {
        color: "#0f6b3a",
        weight: 5,
        opacity: 0.85,
      }).addTo(layerGroup);

      mappedPoints.forEach((point, index) => {
        const marker = L.circleMarker([point.latitude, point.longitude], {
          radius: index === 0 || index === mappedPoints.length - 1 ? 7 : 5,
          color: "#ffffff",
          weight: 2,
          fillColor: index === 0 ? "#0f6b3a" : index === mappedPoints.length - 1 ? "#14532d" : "#5dd18c",
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

      if (mappedPoints.length === 1) {
        map.setView(latLngs[0], 15);
        return;
      }

      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds.pad(0.18), { maxZoom: 15 });
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [points]);

  return <div ref={containerRef} className="h-[360px] w-full bg-[var(--surface-soft)] lg:h-[460px]" />;
}
