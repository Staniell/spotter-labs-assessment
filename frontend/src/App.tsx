import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import TripForm from "./pages/TripForm";
import Results from "./pages/Results";
import History from "./pages/History";
import { Toaster } from "sonner";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#6C63FF" },
    secondary: { main: "#FF6584" },
    background: {
      default: "#0A0E1A",
      paper: "#111827",
    },
  },
  typography: {
    fontFamily: "'Inter', 'Roboto', sans-serif",
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          borderRadius: 10,
          padding: "10px 24px",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 10,
          },
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Toaster position="top-right" theme="dark" richColors />
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<TripForm />} />
            <Route path="/results/:planId" element={<Results />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
