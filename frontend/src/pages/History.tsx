import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Card, CardActionArea, CardContent, Chip, CircularProgress, Grid, Typography } from "@mui/material";
import RouteIcon from "@mui/icons-material/Route";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import { listPlans } from "../api/client";
import type { TripPlanSummary } from "../types";

export default function History() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<TripPlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listPlans()
      .then(setPlans)
      .catch((err) => setError(err.message || "Failed to load plans"))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <Box sx={{ textAlign: "center", mt: 10 }}>
        <CircularProgress sx={{ color: "#6C63FF" }} />
      </Box>
    );

  if (error)
    return (
      <Alert severity="error" sx={{ mt: 4 }}>
        {error}
      </Alert>
    );

  return (
    <Box>
      <Typography
        variant="h4"
        sx={{
          mb: 4,
          background: "linear-gradient(135deg, #e2e8f0, #94a3b8)",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        Previous Trip Plans
      </Typography>

      {plans.length === 0 ? (
        <Box
          sx={{
            textAlign: "center",
            py: 8,
            color: "#64748b",
          }}
        >
          <RouteIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
          <Typography variant="h6">No plans yet</Typography>
          <Typography variant="body2">Create your first trip plan to see it here.</Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {plans.map((plan) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={plan.id}>
              <Card
                sx={{
                  background: "linear-gradient(145deg, #111827, #1a1f36)",
                  border: "1px solid rgba(108,99,255,0.12)",
                  transition: "all 0.3s ease",
                  "&:hover": {
                    border: "1px solid rgba(108,99,255,0.4)",
                    transform: "translateY(-4px)",
                    boxShadow: "0 12px 40px rgba(108,99,255,0.15)",
                  },
                }}
              >
                <CardActionArea onClick={() => navigate(`/results/${plan.id}`)}>
                  <CardContent sx={{ p: 3 }}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mb: 2,
                      }}
                    >
                      <AccessTimeIcon sx={{ fontSize: 16, color: "#64748b" }} />
                      <Typography variant="caption" color="text.secondary">
                        {new Date(plan.created_at).toLocaleString()}
                      </Typography>
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      📍 {plan.current_location}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      📦 {plan.pickup_location}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      🏁 {plan.dropoff_location}
                    </Typography>

                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                      <Chip
                        label={`${Math.round(plan.total_miles)} mi`}
                        size="small"
                        sx={{
                          bgcolor: "rgba(108,99,255,0.15)",
                          color: "#a5b4fc",
                        }}
                      />
                      <Chip
                        label={`${Math.floor(plan.total_drive_minutes / 60)}h ${plan.total_drive_minutes % 60}m`}
                        size="small"
                        sx={{
                          bgcolor: "rgba(255,101,132,0.15)",
                          color: "#fca5a5",
                        }}
                      />
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
