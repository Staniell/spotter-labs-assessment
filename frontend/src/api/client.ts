import axios from "axios";
import type { PlanInput, TripPlan, TripPlanSummary } from "../types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

export async function createPlan(input: PlanInput): Promise<TripPlan> {
  const { data } = await api.post<TripPlan>("/api/plan", input);
  return data;
}

export async function listPlans(): Promise<TripPlanSummary[]> {
  const { data } = await api.get<TripPlanSummary[]>("/api/plans");
  return data;
}

export async function getPlan(id: string): Promise<TripPlan> {
  const { data } = await api.get<TripPlan>(`/api/plans/${id}`);
  return data;
}
