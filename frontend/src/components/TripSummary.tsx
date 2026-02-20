import { Alert, Box, Card, CardContent, Chip, Divider, Typography } from "@mui/material";
import SpeedIcon from "@mui/icons-material/Speed";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import LocalGasStationIcon from "@mui/icons-material/LocalGasStation";
import HotelIcon from "@mui/icons-material/Hotel";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import type { TripPlan } from "../types";

interface Props {
  plan: TripPlan;
}

export default function TripSummary({ plan }: Props) {
  const fuelStops = plan.planned_fuel_stops ?? plan.stops.filter((s) => s.kind === "FUEL").length;
  const restBreaks = plan.stops.filter((s) => s.kind === "BREAK_30").length;
  const resets = plan.stops.filter((s) => s.kind === "OFF_DUTY_10").length;
  const hours = Math.floor(plan.total_drive_minutes / 60);
  const mins = plan.total_drive_minutes % 60;

  const remainH = Math.floor((plan.remaining_drive_minutes ?? 0) / 60);
  const remainM = (plan.remaining_drive_minutes ?? 0) % 60;

  const stats = [
    {
      icon: <SpeedIcon />,
      label: "Total Distance",
      value: `${Math.round(plan.total_miles).toLocaleString()} mi`,
      color: "#6C63FF",
    },
    {
      icon: <AccessTimeIcon />,
      label: "Drive Time",
      value: `${hours}h ${mins}m`,
      color: "#FF6584",
    },
    {
      icon: <LocalGasStationIcon />,
      label: "Fuel Stops",
      value: String(fuelStops),
      color: "#FF9800",
    },
    {
      icon: <HotelIcon />,
      label: "Rest Breaks",
      value: String(restBreaks),
      color: "#4CAF50",
    },
    {
      icon: <HotelIcon />,
      label: "Resets",
      value: String(resets),
      color: "#26A69A",
    },
    {
      icon: <CalendarTodayIcon />,
      label: plan.trip_completed === false ? "Days (partial)" : "Days",
      value: String(plan.daily_sheets.length),
      color: "#2196F3",
    },
  ];

  return (
    <Card
      sx={{
        background: "linear-gradient(145deg, #111827, #1a1f36)",
        border: "1px solid rgba(108,99,255,0.12)",
        height: "100%",
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Trip Summary
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Chip
            label={plan.current_location}
            size="small"
            sx={{
              mb: 0.5,
              bgcolor: "rgba(108,99,255,0.12)",
              color: "#a5b4fc",
              maxWidth: "100%",
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mx: 1 }}>
            →
          </Typography>
          <Chip
            label={plan.pickup_location}
            size="small"
            sx={{
              mb: 0.5,
              bgcolor: "rgba(156,39,176,0.12)",
              color: "#ce93d8",
              maxWidth: "100%",
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mx: 1 }}>
            →
          </Typography>
          <Chip
            label={plan.dropoff_location}
            size="small"
            sx={{
              mb: 0.5,
              bgcolor: "rgba(233,30,99,0.12)",
              color: "#f48fb1",
              maxWidth: "100%",
            }}
          />
        </Box>

        {/* Incomplete trip warning */}
        {plan.trip_completed === false && (
          <Alert
            severity="warning"
            icon={<WarningAmberIcon fontSize="small" />}
            sx={{
              mb: 2,
              bgcolor: "rgba(255,152,0,0.08)",
              border: "1px solid rgba(255,152,0,0.25)",
              color: "#ffb74d",
              "& .MuiAlert-icon": { color: "#ffb74d" },
              borderRadius: 2,
              py: 0.5,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Trip Incomplete
            </Typography>
            <Typography variant="caption" sx={{ display: "block", color: "#ffd54f" }}>
              Insufficient cycle hours. Remaining drive time: {remainH}h {remainM}m. Additional days required after
              cycle hours reset.
            </Typography>
          </Alert>
        )}

        <Divider sx={{ borderColor: "rgba(255,255,255,0.06)", my: 2 }} />

        {stats.map(({ icon, label, value, color }) => (
          <Box
            key={label}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              py: 1.5,
              px: 1.5,
              borderRadius: 2,
              mb: 1,
              bgcolor: "rgba(255,255,255,0.02)",
              "&:hover": { bgcolor: "rgba(255,255,255,0.04)" },
              transition: "background 0.2s",
            }}
          >
            <Box sx={{ color, display: "flex" }}>{icon}</Box>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {value}
              </Typography>
            </Box>
          </Box>
        ))}

        {plan.stops.length > 0 && (
          <>
            <Divider sx={{ borderColor: "rgba(255,255,255,0.06)", my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Stop Details
            </Typography>
            {plan.stops.map((stop, i) => {
              const h = Math.floor(stop.start_minute_global / 60);
              const m = stop.start_minute_global % 60;
              return (
                <Typography key={i} variant="body2" color="text.secondary" sx={{ mb: 0.5, fontSize: 12 }}>
                  {`${h}h${m > 0 ? `${m}m` : ""}`} — {stop.label} ({stop.duration_minutes} min)
                </Typography>
              );
            })}
          </>
        )}
      </CardContent>
    </Card>
  );
}
