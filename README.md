# TripPlan HOS — Full-Stack Trip Planner

A production-quality web application that generates **HOS-compliant route plans** for commercial truck drivers, complete with interactive maps and **printable Driver's Daily Log sheets**.

## Features

- **HOS Compliance Engine** — Implements FMCSA property-carrying driver rules:
  - 11-hour driving limit
  - 14-hour on-duty window
  - 30-minute break after 8 hours of driving
  - 70-hour / 8-day rolling cycle limit
  - 10-hour off-duty reset
  - Fuel stops every 1,000 miles
  - 1-hour pickup / dropoff handling
- **Route Planning** — Integration with OpenRouteService (driving-hgv profile)
- **Interactive Map** — MapLibre GL JS with route polyline, glow effects, and stop markers
- **Daily Log Sheets** — SVG-rendered Driver's Daily Logs with 24-hour grid and duty status lines
- **PDF Export** — Download all daily logs as a multi-page PDF
- **Plan History** — View and re-render previously saved trip plans

---

## Tech Stack

| Layer    | Technology                                |
| -------- | ----------------------------------------- |
| Backend  | Django 5, Django REST Framework           |
| Frontend | React 18, TypeScript, MUI v6              |
| Maps     | MapLibre GL JS + OpenFreeMap tiles        |
| Routing  | OpenRouteService (ORS)                    |
| Database | PostgreSQL (prod) / SQLite (dev fallback) |
| PDF      | jsPDF (SVG → PNG → PDF)                   |

---

## Project Structure

```
spotter-labs-assessment/
├── backend/
│   ├── config/          # Django settings, urls, wsgi
│   ├── trips/
│   │   ├── models.py        # TripPlan, Stop, DailySheet, Segment
│   │   ├── serializers.py   # DRF serializers with nested data
│   │   ├── hos_engine.py    # Core HOS compliance engine
│   │   ├── routing_client.py # ORS geocoding + directions
│   │   ├── views.py         # API views (POST /api/plan, GET /api/plans)
│   │   └── tests/           # 11 HOS unit tests ✓
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/client.ts     # Axios API client
│   │   ├── types.ts          # TypeScript interfaces
│   │   ├── pages/            # TripForm, Results, History
│   │   ├── components/       # Layout, RouteMap, TripSummary, DailyLogSheet
│   │   └── App.tsx           # Router + Dark MUI theme
│   └── package.json
└── README.md
```

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- [OpenRouteService API key](https://openrouteservice.org/) (free tier)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # macOS/Linux

pip install -r requirements.txt

# Create .env from template
cp .env.example .env
# Edit .env → add your ORS_API_KEY

python manage.py migrate
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Run Tests

```bash
cd backend
python manage.py test trips.tests.test_hos_engine -v 2
```

---

## API Endpoints

| Method | Endpoint         | Description                |
| ------ | ---------------- | -------------------------- |
| POST   | `/api/plan`      | Create a new trip plan     |
| GET    | `/api/plans`     | List all saved plans       |
| GET    | `/api/plans/:id` | Get a specific plan detail |

### POST /api/plan — Request Body

```json
{
  "current_location": "New York, NY",
  "pickup_location": "Philadelphia, PA",
  "dropoff_location": "Chicago, IL",
  "cycle_used_hours": 10
}
```

---

## Environment Variables

### Backend (`.env`)

| Variable               | Description                         |
| ---------------------- | ----------------------------------- |
| `SECRET_KEY`           | Django secret key                   |
| `DEBUG`                | Debug mode (True/False)             |
| `DATABASE_URL`         | Database URL (PostgreSQL or SQLite) |
| `ORS_API_KEY`          | OpenRouteService API key            |
| `ALLOWED_HOSTS`        | Comma-separated allowed hosts       |
| `CORS_ALLOWED_ORIGINS` | Comma-separated CORS origins        |

### Frontend (`.env`)

| Variable       | Description          |
| -------------- | -------------------- |
| `VITE_API_URL` | Backend API base URL |
