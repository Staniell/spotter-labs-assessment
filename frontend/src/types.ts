// ── TypeScript interfaces matching Django REST API responses ──

export interface Segment {
  id: string;
  start_minute: number;
  end_minute: number;
  status: DutyStatus;
  location_label: string;
}

export interface Remark {
  time: string;
  status: DutyStatus;
  location: string;
}

export interface DailySheet {
  id: string;
  date: string;
  total_miles_today: number;
  segments: Segment[];
  totals: Record<DutyStatus, number>;
  remarks: Remark[];
}

export interface Stop {
  id: string;
  kind: StopKind;
  lat: number;
  lng: number;
  label: string;
  start_minute_global: number;
  duration_minutes: number;
}

export interface TripPlan {
  id: string;
  current_location: string;
  pickup_location: string;
  dropoff_location: string;
  cycle_used_hours: number;
  routing_provider: string;
  total_miles: number;
  total_drive_minutes: number;
  route_polyline: string;
  current_location_lat: number;
  current_location_lng: number;
  pickup_location_lat: number;
  pickup_location_lng: number;
  dropoff_location_lat: number;
  dropoff_location_lng: number;
  trip_completed: boolean;
  remaining_drive_minutes: number;
  planned_fuel_stops: number;
  daily_sheets: DailySheet[];
  stops: Stop[];
  created_at: string;
}

export interface TripPlanSummary {
  id: string;
  current_location: string;
  pickup_location: string;
  dropoff_location: string;
  total_miles: number;
  total_drive_minutes: number;
  created_at: string;
}

export interface PlanInput {
  current_location: string;
  pickup_location: string;
  dropoff_location: string;
  cycle_used_hours: number;
}

export type DutyStatus = "OFF_DUTY" | "SLEEPER" | "DRIVING" | "ON_DUTY_NOT_DRIVING";

export type StopKind = "FUEL" | "BREAK_30" | "OFF_DUTY_10" | "PICKUP" | "DROPOFF";

export const DUTY_STATUS_LABELS: Record<DutyStatus, string> = {
  OFF_DUTY: "Off Duty",
  SLEEPER: "Sleeper Berth",
  DRIVING: "Driving",
  ON_DUTY_NOT_DRIVING: "On Duty (Not Driving)",
};

export const DUTY_STATUS_COLORS: Record<DutyStatus, string> = {
  OFF_DUTY: "#4CAF50",
  SLEEPER: "#2196F3",
  DRIVING: "#F44336",
  ON_DUTY_NOT_DRIVING: "#FF9800",
};

export const STOP_KIND_COLORS: Record<StopKind, string> = {
  FUEL: "#FF9800",
  BREAK_30: "#4CAF50",
  OFF_DUTY_10: "#2196F3",
  PICKUP: "#9C27B0",
  DROPOFF: "#E91E63",
};

export const STOP_KIND_LABELS: Record<StopKind, string> = {
  FUEL: "Fuel",
  BREAK_30: "30-min Break",
  OFF_DUTY_10: "10h Off Duty",
  PICKUP: "Pickup",
  DROPOFF: "Dropoff",
};

// Demo carrier constants
export const CARRIER = {
  name: "Swift Freight Lines Inc.",
  mainOffice: "1200 Industrial Blvd, Dallas, TX 75201",
  homeTerminal: "Dallas, TX",
  truckNumber: "TRK-4821",
  trailerNumber: "TRL-9037",
};
