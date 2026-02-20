import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import TimerIcon from "@mui/icons-material/Timer";
import RouteIcon from "@mui/icons-material/Route";
import { createPlan } from "../api/client";
import LocationPickerMap from "../components/LocationPickerMap";

interface LocationData {
  lat: number;
  lng: number;
  name: string;
}

export default function TripForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [cycleHours, setCycleHours] = useState(0);

  const [current, setCurrent] = useState<LocationData | null>(null);
  const [pickup, setPickup] = useState<LocationData | null>(null);
  const [dropoff, setDropoff] = useState<LocationData | null>(null);

  const handleLocationChange = useCallback((field: "current" | "pickup" | "dropoff", data: LocationData) => {
    if (field === "current") setCurrent(data);
    else if (field === "pickup") setPickup(data);
    else setDropoff(data);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!current || !pickup || !dropoff) {
      toast.error("Please set all three locations on the map.");
      return;
    }
    if (cycleHours < 0 || cycleHours > 70) {
      toast.error("Cycle used hours must be between 0 and 70.");
      return;
    }

    setLoading(true);
    try {
      const plan = await createPlan({
        current_location: current.name,
        pickup_location: pickup.name,
        dropoff_location: dropoff.name,
        cycle_used_hours: cycleHours,
        current_lat: current.lat,
        current_lng: current.lng,
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
      });
      navigate(`/results/${plan.id}`);
    } catch (err: unknown) {
      let msg = "An unexpected error occurred. Please try again.";

      if (typeof err === "object" && err !== null && "response" in err) {
        const axiosErr = err as {
          response?: {
            status?: number;
            data?: {
              error?: string | { message?: string; code?: number };
              message?: string;
              detail?: string;
            };
          };
        };
        const data = axiosErr.response?.data;
        const status = axiosErr.response?.status;

        if (data) {
          if (data.error && typeof data.error === "object" && data.error.message) {
            msg = data.error.message;
          } else {
            const raw = data.message || data.detail || (typeof data.error === "string" ? data.error : "");
            if (raw) {
              const match = raw.match(/['"]message['"]:\s*['"](.*?)['"]/);
              msg = match ? match[1] : raw;
            }
          }
        }

        if (msg === "An unexpected error occurred. Please try again.") {
          if (status === 404) msg = "Route could not be found between the given locations.";
          else if (status === 400) msg = "Invalid request. Please check your inputs.";
          else if (status === 500) msg = "Server error. Please try again later.";
        }
      } else if (err instanceof Error) {
        msg = err.message;
      }

      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        maxWidth: 720,
        mx: "auto",
        mt: { xs: 2, md: 4 },
      }}
    >
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(108,99,255,0.2), rgba(255,101,132,0.2))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mx: "auto",
            mb: 3,
          }}
        >
          <RouteIcon sx={{ fontSize: 36, color: "#6C63FF" }} />
        </Box>
        <Typography
          variant="h4"
          sx={{
            background: "linear-gradient(135deg, #e2e8f0, #94a3b8)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            mb: 1,
          }}
        >
          Plan Your Trip
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Click the map to set your locations, then generate an HOS-compliant route plan
        </Typography>
      </Box>

      <Card
        sx={{
          background: "linear-gradient(145deg, #111827 0%, #1a1f36 100%)",
          border: "1px solid rgba(108, 99, 255, 0.15)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
        }}
      >
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <form onSubmit={handleSubmit}>
            <Grid container spacing={2.5}>
              {/* Map picker */}
              <Grid size={12}>
                <LocationPickerMap
                  current={current}
                  pickup={pickup}
                  dropoff={dropoff}
                  onLocationChange={handleLocationChange}
                />
              </Grid>

              {/* Cycle hours */}
              <Grid size={12}>
                <TextField
                  fullWidth
                  type="number"
                  label="Current Cycle Used (hours)"
                  placeholder="0"
                  value={cycleHours || ""}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setCycleHours(Math.min(val, 70));
                  }}
                  helperText="Hours used in the 70-hour / 8-day cycle (0–70)"
                  inputProps={{ min: 0, max: 70, step: 0.5 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <TimerIcon sx={{ color: "#FF9800" }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              {/* Submit */}
              <Grid size={12}>
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading || !current || !pickup || !dropoff}
                  sx={{
                    py: 1.5,
                    fontSize: 16,
                    background: "linear-gradient(135deg, #6C63FF, #5a52e0)",
                    "&:hover": {
                      background: "linear-gradient(135deg, #5a52e0, #4a43d0)",
                    },
                    "&.Mui-disabled": {
                      background: "rgba(108, 99, 255, 0.2)",
                      color: "rgba(255,255,255,0.3)",
                    },
                  }}
                >
                  {loading ? <CircularProgress size={24} sx={{ color: "#fff" }} /> : "Generate Route Plan"}
                </Button>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
