import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Alert, Box, Button, CircularProgress, Grid, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { getPlan } from "../api/client";
import type { TripPlan } from "../types";
import RouteMap from "../components/RouteMap";
import TripSummary from "../components/TripSummary";
import DailyLogSheet from "../components/DailyLogSheet";
import { downloadAllSheets } from "../components/LogSheetDownloader";

export default function Results() {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!planId) return;
    getPlan(planId)
      .then(setPlan)
      .catch((err) => setError(err.message || "Failed to load plan"))
      .finally(() => setLoading(false));
  }, [planId]);

  if (loading)
    return (
      <Box sx={{ textAlign: "center", mt: 10 }}>
        <CircularProgress sx={{ color: "#6C63FF" }} />
        <Typography sx={{ mt: 2 }} color="text.secondary">
          Loading trip plan…
        </Typography>
      </Box>
    );

  if (error)
    return (
      <Alert severity="error" sx={{ mt: 4 }}>
        {error}
      </Alert>
    );

  if (!plan) return null;

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 2, md: 4 }, py: 4 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 4,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/")}
          sx={{
            color: "#94a3b8",
            "&:hover": { color: "#f1f5f9", background: "rgba(255,255,255,0.05)" },
          }}
        >
          New Trip
        </Button>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            background: "linear-gradient(135deg, #f8fafc, #94a3b8)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-0.02em",
          }}
        >
          Trip Results
        </Typography>
        <Button
          startIcon={<DownloadIcon />}
          variant="contained"
          onClick={() => downloadAllSheets(plan)}
          sx={{
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            fontWeight: 600,
            px: 3,
            borderRadius: 2,
            boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
            "&:hover": {
              boxShadow: "0 6px 16px rgba(99,102,241,0.4)",
            },
          }}
        >
          Download Logs
        </Button>
      </Box>

      {/* Incomplete trip warning */}
      {plan.trip_completed === false && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon />}
          sx={{
            mb: 3,
            bgcolor: "rgba(255,152,0,0.06)",
            border: "1px solid rgba(255,152,0,0.25)",
            color: "#ffb74d",
            borderRadius: 2,
            "& .MuiAlert-icon": { color: "#ffb74d" },
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Driver has insufficient cycle hours to complete this trip.
          </Typography>
          <Typography variant="caption" sx={{ color: "#ffd54f" }}>
            Only {Math.floor((plan.total_drive_minutes - plan.remaining_drive_minutes) / 60)}h{" "}
            {(plan.total_drive_minutes - plan.remaining_drive_minutes) % 60}m of the{" "}
            {Math.floor(plan.total_drive_minutes / 60)}h {plan.total_drive_minutes % 60}m route could be driven.
            Additional days required after cycle hours reset.
          </Typography>
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Map */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Box
            sx={{
              height: { xs: 350, md: 500 },
              borderRadius: 3,
              overflow: "hidden",
              border: "1px solid rgba(108,99,255,0.15)",
            }}
          >
            <RouteMap plan={plan} />
          </Box>
        </Grid>

        {/* Summary */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <TripSummary plan={plan} />
        </Grid>

        {/* Daily Log Sheets */}
        <Grid size={12}>
          <Box sx={{ mt: 6, mb: 3, display: "flex", alignItems: "center", gap: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: "#f8fafc" }}>
              Driver's Daily Logs
            </Typography>
            <Box
              sx={{ height: 1, flexGrow: 1, background: "linear-gradient(90deg, rgba(148,163,184,0.2), transparent)" }}
            />
          </Box>

          <Box sx={{ display: "grid", gap: 4 }}>
            {plan.daily_sheets.map((sheet) => (
              <Box key={sheet.id} id={`sheet-${sheet.id}`}>
                <DailyLogSheet sheet={sheet} plan={plan} />
              </Box>
            ))}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
