import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Box, ToggleButton, ToggleButtonGroup, Typography, Chip } from "@mui/material";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import WhereToVoteIcon from "@mui/icons-material/WhereToVote";

// ── Continental US bounds (excluding Alaska) ─────────────────────────
const CONUS_BOUNDS: [[number, number], [number, number]] = [
  [-125, 24], // SW corner (lng, lat)
  [-66, 50], // NE corner (lng, lat)
];
const CONUS_CENTER: [number, number] = [-96, 38]; // lng, lat

type LocationField = "current" | "pickup" | "dropoff";

interface LocationData {
  lat: number;
  lng: number;
  name: string;
}

interface Props {
  current: LocationData | null;
  pickup: LocationData | null;
  dropoff: LocationData | null;
  onLocationChange: (field: LocationField, data: LocationData) => void;
}

const FIELD_CONFIG: Record<LocationField, { label: string; color: string; emoji: string }> = {
  current: { label: "Current Location", color: "#6C63FF", emoji: "📍" },
  pickup: { label: "Pickup Location", color: "#9C27B0", emoji: "📦" },
  dropoff: { label: "Dropoff Location", color: "#E91E63", emoji: "🏁" },
};

// ── Reverse geocode via Nominatim ──────────────────────────────────
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lng.toString(),
      format: "json",
      zoom: "10",
      addressdetails: "1",
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: { "User-Agent": "SpotterLabsTripPlanner/1.0" },
    });
    const data = await res.json();
    if (data?.address) {
      const a = data.address;
      const city = a.city || a.town || a.village || a.hamlet || a.county || "";
      const state = a.state || "";
      return city && state ? `${city}, ${state}` : data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
    return data?.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

export default function LocationPickerMap({ current, pickup, dropoff, onLocationChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Record<LocationField, maplibregl.Marker | null>>({
    current: null,
    pickup: null,
    dropoff: null,
  });
  const [activeField, setActiveField] = useState<LocationField>("current");

  // ── Create / destroy map ────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: CONUS_CENTER,
      zoom: 4,
      maxBounds: CONUS_BOUNDS,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Handle map clicks ──────────────────────────────────────────
  const handleMapClick = useCallback(
    async (e: maplibregl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat;
      const name = await reverseGeocode(lat, lng);
      onLocationChange(activeField, { lat, lng, name });
    },
    [activeField, onLocationChange],
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.on("click", handleMapClick);
    return () => {
      map.off("click", handleMapClick);
    };
  }, [handleMapClick]);

  // ── Update cursor per mode ─────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = "crosshair";
  }, [activeField]);

  // ── Sync markers to location state ─────────────────────────────
  const upsertMarker = useCallback(
    (field: LocationField, loc: LocationData | null) => {
      const map = mapRef.current;
      if (!map) return;

      // Remove old marker
      if (markersRef.current[field]) {
        markersRef.current[field]!.remove();
        markersRef.current[field] = null;
      }

      if (!loc) return;

      const cfg = FIELD_CONFIG[field];
      const el = document.createElement("div");
      el.style.width = "20px";
      el.style.height = "20px";
      el.style.borderRadius = "50%";
      el.style.background = cfg.color;
      el.style.border = "3px solid #fff";
      el.style.boxShadow = `0 0 14px ${cfg.color}88`;
      el.style.cursor = "pointer";

      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([loc.lng, loc.lat])
        .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(`<b>${cfg.emoji} ${cfg.label}</b><br/>${loc.name}`))
        .addTo(map);

      // Allow drag to update position
      marker.on("dragend", async () => {
        const pos = marker.getLngLat();
        const name = await reverseGeocode(pos.lat, pos.lng);
        onLocationChange(field, { lat: pos.lat, lng: pos.lng, name });
      });

      markersRef.current[field] = marker;
    },
    [onLocationChange],
  );

  useEffect(() => {
    upsertMarker("current", current);
  }, [current, upsertMarker]);
  useEffect(() => {
    upsertMarker("pickup", pickup);
  }, [pickup, upsertMarker]);
  useEffect(() => {
    upsertMarker("dropoff", dropoff);
  }, [dropoff, upsertMarker]);

  // ── Auto-advance mode after placement ──────────────────────────
  useEffect(() => {
    if (current && !pickup) setActiveField("pickup");
    else if (current && pickup && !dropoff) setActiveField("dropoff");
  }, [current, pickup, dropoff]);

  return (
    <Box>
      {/* Mode selector */}
      <Box sx={{ mb: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
          Click the map to place each location. Drag markers to adjust.
        </Typography>
        <ToggleButtonGroup
          value={activeField}
          exclusive
          onChange={(_e, val) => {
            if (val) setActiveField(val);
          }}
          size="small"
          fullWidth
          sx={{
            "& .MuiToggleButton-root": {
              color: "rgba(255,255,255,0.6)",
              borderColor: "rgba(108, 99, 255, 0.25)",
              textTransform: "none",
              fontSize: 13,
              py: 0.8,
              "&.Mui-selected": {
                color: "#fff",
                borderColor: "rgba(108, 99, 255, 0.5)",
              },
            },
          }}
        >
          <ToggleButton value="current" sx={{ "&.Mui-selected": { background: "rgba(108, 99, 255, 0.18)" } }}>
            <LocationOnIcon sx={{ fontSize: 18, mr: 0.5, color: "#6C63FF" }} />
            Current
          </ToggleButton>
          <ToggleButton value="pickup" sx={{ "&.Mui-selected": { background: "rgba(156, 39, 176, 0.18)" } }}>
            <LocalShippingIcon sx={{ fontSize: 18, mr: 0.5, color: "#9C27B0" }} />
            Pickup
          </ToggleButton>
          <ToggleButton value="dropoff" sx={{ "&.Mui-selected": { background: "rgba(233, 30, 99, 0.18)" } }}>
            <WhereToVoteIcon sx={{ fontSize: 18, mr: 0.5, color: "#E91E63" }} />
            Dropoff
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Map container */}
      <Box
        ref={containerRef}
        sx={{
          width: "100%",
          height: 380,
          borderRadius: 2,
          overflow: "hidden",
          position: "relative",
          border: `2px solid ${FIELD_CONFIG[activeField].color}44`,
          transition: "border-color 0.3s ease",
          "& .maplibregl-map": {
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          },
        }}
      />

      {/* Selected locations display */}
      <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", gap: 1 }}>
        {(["current", "pickup", "dropoff"] as LocationField[]).map((field) => {
          const loc = field === "current" ? current : field === "pickup" ? pickup : dropoff;
          const cfg = FIELD_CONFIG[field];
          return (
            <Chip
              key={field}
              size="small"
              label={loc ? `${cfg.emoji} ${loc.name}` : `${cfg.emoji} ${cfg.label}: click map`}
              variant={loc ? "filled" : "outlined"}
              onClick={() => setActiveField(field)}
              sx={{
                borderColor: loc ? cfg.color : "rgba(255,255,255,0.2)",
                color: loc ? "#fff" : "rgba(255,255,255,0.4)",
                background: loc ? `${cfg.color}22` : "transparent",
                fontSize: 12,
                maxWidth: 220,
                cursor: "pointer",
                "&:hover": { background: `${cfg.color}33` },
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
}
