'use client';

import { useEffect, useRef } from 'react';
import type { Map as LeafletMapInstance, Marker } from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  sublabel?: string;
}

interface OffsetLocationMapProps {
  markers: MapMarker[];
  color: string;
  heightClassName?: string;
}

export default function OffsetLocationMap({ markers, color, heightClassName = 'h-56' }: OffsetLocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, { zoomControl: true, attributionControl: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
        }).addTo(mapRef.current);
      }

      const map = mapRef.current;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const icon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,0.15)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      markers.forEach((m) => {
        const marker = L.marker([m.lat, m.lng], { icon }).addTo(map);
        marker.bindTooltip(`${m.label}${m.sublabel ? ` — ${m.sublabel}` : ''}`);
        markersRef.current.push(marker);
      });

      if (markers.length > 0) {
        const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [24, 24], maxZoom: 12 });
      } else {
        map.setView([11.4, 78.3], 8);
      }

      setTimeout(() => map.invalidateSize(), 50);
    })();

    return () => {
      cancelled = true;
    };
  }, [markers, color]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className={`w-full ${heightClassName} rounded-lg overflow-hidden`} />;
}
