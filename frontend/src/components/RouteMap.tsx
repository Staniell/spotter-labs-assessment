import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { TripPlan } from "../types";
import { STOP_KIND_COLORS, STOP_KIND_LABELS } from "../types";

// Decode Google-style encoded polyline
function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coords.push([lng / 1e5, lat / 1e5]);
  }
  return coords;
}

interface Props {
  plan: TripPlan;
}

export default function RouteMap({ plan }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [plan.current_location_lng, plan.current_location_lat],
      zoom: 5,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      // Route polyline
      if (plan.route_polyline) {
        const coords = decodePolyline(plan.route_polyline);
        map.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: coords },
          },
        });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#6C63FF",
            "line-width": 4,
            "line-opacity": 0.8,
          },
        });
        // Glow effect
        map.addLayer({
          id: "route-glow",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#6C63FF",
            "line-width": 12,
            "line-opacity": 0.15,
          },
        });

        // Fit bounds to route
        const bounds = coords.reduce(
          (b, c) => b.extend(c as [number, number]),
          new maplibregl.LngLatBounds(coords[0], coords[0]),
        );
        map.fitBounds(bounds, { padding: 60 });
      }

      // Location markers
      const locations = [
        {
          lng: plan.current_location_lng,
          lat: plan.current_location_lat,
          label: `📍 Start: ${plan.current_location}`,
          color: "#6C63FF",
        },
        {
          lng: plan.pickup_location_lng,
          lat: plan.pickup_location_lat,
          label: `📦 Pickup: ${plan.pickup_location}`,
          color: "#9C27B0",
        },
        {
          lng: plan.dropoff_location_lng,
          lat: plan.dropoff_location_lat,
          label: `🏁 Dropoff: ${plan.dropoff_location}`,
          color: "#E91E63",
        },
      ];

      locations.forEach(({ lng, lat, label, color }) => {
        const el = document.createElement("div");
        el.style.width = "16px";
        el.style.height = "16px";
        el.style.borderRadius = "50%";
        el.style.background = color;
        el.style.border = "3px solid #fff";
        el.style.boxShadow = `0 0 12px ${color}80`;

        new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .setPopup(new maplibregl.Popup({ offset: 10 }).setHTML(`<b>${label}</b>`))
          .addTo(map);
      });

      // Stop markers
      plan.stops.forEach((stop) => {
        if (!stop.lat || !stop.lng) return;
        const color = STOP_KIND_COLORS[stop.kind] || "#888";
        const el = document.createElement("div");
        el.style.width = "10px";
        el.style.height = "10px";
        el.style.borderRadius = "50%";
        el.style.background = color;
        el.style.border = "2px solid #fff";
        el.style.boxShadow = `0 0 8px ${color}80`;

        new maplibregl.Marker({ element: el })
          .setLngLat([stop.lng, stop.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 8 }).setHTML(`<b>${STOP_KIND_LABELS[stop.kind]}</b><br/>${stop.label}`),
          )
          .addTo(map);
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [plan]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
