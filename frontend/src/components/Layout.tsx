import type { ReactNode } from "react";
import { AppBar, Box, Button, Container, Toolbar, Typography } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import HistoryIcon from "@mui/icons-material/History";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          background: "linear-gradient(135deg, #111827 0%, #1a1f36 100%)",
          borderBottom: "1px solid rgba(108, 99, 255, 0.2)",
          backdropFilter: "blur(20px)",
        }}
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ gap: 2 }}>
            <LocalShippingIcon
              sx={{
                fontSize: 32,
                color: "#6C63FF",
                filter: "drop-shadow(0 0 8px rgba(108, 99, 255, 0.4))",
              }}
            />
            <Typography
              variant="h6"
              sx={{
                flexGrow: 1,
                background: "linear-gradient(135deg, #6C63FF, #FF6584)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                cursor: "pointer",
              }}
              onClick={() => navigate("/")}
            >
              TripPlan HOS
            </Typography>
            <Button
              startIcon={<AddCircleOutlineIcon />}
              variant={location.pathname === "/" ? "contained" : "text"}
              onClick={() => navigate("/")}
              sx={{
                color: location.pathname === "/" ? "#fff" : "#94a3b8",
                ...(location.pathname === "/" && {
                  background: "linear-gradient(135deg, #6C63FF, #5a52e0)",
                }),
              }}
            >
              New Trip
            </Button>
            <Button
              startIcon={<HistoryIcon />}
              variant={location.pathname === "/history" ? "contained" : "text"}
              onClick={() => navigate("/history")}
              sx={{
                color: location.pathname === "/history" ? "#fff" : "#94a3b8",
                ...(location.pathname === "/history" && {
                  background: "linear-gradient(135deg, #6C63FF, #5a52e0)",
                }),
              }}
            >
              History
            </Button>
          </Toolbar>
        </Container>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1, py: 4, px: { xs: 2, md: 4 } }}>
        <Container maxWidth="xl">{children}</Container>
      </Box>

      <Box
        component="footer"
        sx={{
          py: 2,
          textAlign: "center",
          borderTop: "1px solid rgba(108, 99, 255, 0.1)",
          color: "#64748b",
          fontSize: 13,
        }}
      >
        TripPlan HOS — Spotter Labs Assessment
      </Box>
    </Box>
  );
}
