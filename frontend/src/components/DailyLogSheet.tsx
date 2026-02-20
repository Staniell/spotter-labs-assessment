import React from "react";
import { Box } from "@mui/material";
import type { DailySheet, DutyStatus, TripPlan } from "../types";
import { CARRIER, DUTY_STATUS_COLORS } from "../types";

interface Props {
  sheet: DailySheet;
  plan: TripPlan;
}

// ── SVG layout constants ──────────────────────────────────────────
const W = 1000;
const GRID_LEFT = 140;
const GRID_RIGHT = W - 60;
const GRID_TOP = 175;
const ROW_H = 42;
const HOUR_W = (GRID_RIGHT - GRID_LEFT) / 24;

const STATUS_ORDER: DutyStatus[] = ["OFF_DUTY", "SLEEPER", "DRIVING", "ON_DUTY_NOT_DRIVING"];

const STATUS_LABELS: Record<DutyStatus, string> = {
  OFF_DUTY: "1. Off Duty",
  SLEEPER: "2. Sleeper\n   Berth",
  DRIVING: "3. Driving",
  ON_DUTY_NOT_DRIVING: "4. On Duty\n   (Not Driving)",
};

export default function DailyLogSheet({ sheet, plan }: Props) {
  const gridBottom = GRID_TOP + STATUS_ORDER.length * ROW_H;

  // Build remarks from segments
  const remarks: string[] = [];
  let prevStatus = "";
  for (const seg of sheet.segments) {
    if (seg.status !== prevStatus) {
      const h = Math.floor(seg.start_minute / 60);
      const m = seg.start_minute % 60;
      const label = seg.location_label || "—";
      remarks.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} — ${label}`);
      prevStatus = seg.status;
    }
  }

  // Compute totals per status
  const totals: Record<DutyStatus, number> = {
    OFF_DUTY: 0,
    SLEEPER: 0,
    DRIVING: 0,
    ON_DUTY_NOT_DRIVING: 0,
  };
  for (const seg of sheet.segments) {
    totals[seg.status] += seg.end_minute - seg.start_minute;
  }

  // Calculate dynamic height based on number of remarks
  const displayRemarks = remarks.slice(0, 10);
  const dynamicHeight = Math.max(450, gridBottom + 70 + displayRemarks.length * 16);

  return (
    <Box
      className="log-sheet-svg"
      sx={{
        background: "#fff",
        borderRadius: 2,
        overflow: "auto",
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${dynamicHeight}`}
        width="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block", fontFamily: "'Inter', Arial, sans-serif" }}
      >
        {/* ── Background ── */}
        <rect width={W} height={dynamicHeight} fill="#ffffff" />

        {/* ── Title ── */}
        <text x={W / 2} y={30} textAnchor="middle" fontSize={20} fontWeight={700} fill="#111">
          Driver's Daily Log
        </text>
        <text x={W / 2} y={48} textAnchor="middle" fontSize={11} fill="#666">
          (24 Hours)
        </text>

        {/* ── Date ── */}
        <text x={50} y={72} fontSize={12} fill="#333">
          Date:
        </text>
        <text x={90} y={72} fontSize={13} fontWeight={600} fill="#111">
          {sheet.date}
        </text>

        {/* ── Header info ── */}
        <text x={50} y={95} fontSize={11} fill="#555">
          Total Miles Driving Today: {Math.round(sheet.total_miles_today)}
        </text>

        {/* Right column info */}
        <text x={500} y={72} fontSize={11} fill="#555">
          Carrier: {CARRIER.name}
        </text>
        <text x={500} y={88} fontSize={11} fill="#555">
          Main Office: {CARRIER.mainOffice}
        </text>
        <text x={500} y={104} fontSize={11} fill="#555">
          Truck/Tractor: {CARRIER.truckNumber} | Trailer: {CARRIER.trailerNumber}
        </text>

        {/* From / To */}
        <text x={50} y={115} fontSize={11} fill="#555">
          From: {plan.current_location}
        </text>
        <text x={500} y={115} fontSize={11} fill="#555">
          To: {plan.dropoff_location}
        </text>

        {/* ── Separator ── */}
        <line x1={30} y1={130} x2={W - 30} y2={130} stroke="#ddd" strokeWidth={1} />

        {/* ── Hour header ── */}
        <text x={GRID_LEFT - 5} y={GRID_TOP - 15} textAnchor="end" fontSize={9} fill="#888">
          Mid-
        </text>
        <text x={GRID_LEFT - 5} y={GRID_TOP - 5} textAnchor="end" fontSize={9} fill="#888">
          night
        </text>

        {Array.from({ length: 25 }).map((_, i) => {
          const x = GRID_LEFT + i * HOUR_W;
          const label = i === 0 ? "" : i === 12 ? "Noon" : i === 24 ? "" : i > 12 ? String(i - 12) : String(i);
          return (
            <g key={`hour-${i}`}>
              <line x1={x} y1={GRID_TOP} x2={x} y2={gridBottom} stroke="#bbb" strokeWidth={i % 6 === 0 ? 1.5 : 0.5} />
              {label && (
                <text x={x} y={GRID_TOP - 5} textAnchor="middle" fontSize={9} fill="#666">
                  {label}
                </text>
              )}
            </g>
          );
        })}

        {/* 15-minute marks */}
        {Array.from({ length: 96 }).map((_, i) => {
          const x = GRID_LEFT + (i / 96) * (GRID_RIGHT - GRID_LEFT);
          if (i % 4 === 0) return null; // skip full hours
          return <line key={`q-${i}`} x1={x} y1={GRID_TOP} x2={x} y2={gridBottom} stroke="#e0e0e0" strokeWidth={0.3} />;
        })}

        {/* Total column header */}
        <text x={GRID_RIGHT + 15} y={GRID_TOP - 5} textAnchor="start" fontSize={9} fill="#888">
          Total
        </text>
        <text x={GRID_RIGHT + 15} y={GRID_TOP + 5} textAnchor="start" fontSize={9} fill="#888">
          Hours
        </text>

        {/* ── Status rows ── */}
        {STATUS_ORDER.map((status, rowIdx) => {
          const y = GRID_TOP + rowIdx * ROW_H;
          const label = STATUS_LABELS[status];
          const lines = label.split("\n");
          const totalMins = totals[status];
          const totalHrs = (totalMins / 60).toFixed(1);

          return (
            <g key={status}>
              {/* Row background */}
              <rect
                x={GRID_LEFT}
                y={y}
                width={GRID_RIGHT - GRID_LEFT}
                height={ROW_H}
                fill={rowIdx % 2 === 0 ? "#fafafa" : "#fff"}
              />

              {/* Row divider */}
              <line x1={30} y1={y + ROW_H} x2={W - 30} y2={y + ROW_H} stroke="#ccc" strokeWidth={0.5} />

              {/* Row label */}
              {lines.map((line, li) => (
                <text
                  key={li}
                  x={GRID_LEFT - 8}
                  y={y + ROW_H / 2 - (lines.length - 1) * 6 + li * 13}
                  textAnchor="end"
                  fontSize={10}
                  fill="#444"
                  dominantBaseline="central"
                >
                  {line.trim()}
                </text>
              ))}

              {/* Total hours */}
              <text x={GRID_RIGHT + 20} y={y + ROW_H / 2 + 4} fontSize={11} fontWeight={600} fill="#333">
                {totalHrs}
              </text>

              {/* ── Draw duty status lines ── */}
              {sheet.segments
                .filter((seg) => seg.status === status)
                .map((seg, segIdx) => {
                  const x1 = GRID_LEFT + (seg.start_minute / 1440) * (GRID_RIGHT - GRID_LEFT);
                  const x2 = GRID_LEFT + (seg.end_minute / 1440) * (GRID_RIGHT - GRID_LEFT);
                  const yCenter = y + ROW_H / 2;
                  return (
                    <line
                      key={segIdx}
                      x1={x1}
                      y1={yCenter}
                      x2={x2}
                      y2={yCenter}
                      stroke={DUTY_STATUS_COLORS[status]}
                      strokeWidth={4}
                      strokeLinecap="round"
                    />
                  );
                })}
            </g>
          );
        })}

        {/* ── Vertical connectors between status changes ── */}
        {(() => {
          const connectors: React.JSX.Element[] = [];
          const sortedSegs = [...sheet.segments].sort((a, b) => a.start_minute - b.start_minute);
          for (let i = 1; i < sortedSegs.length; i++) {
            const prev = sortedSegs[i - 1];
            const curr = sortedSegs[i];
            if (prev.status === curr.status) continue;

            const prevRowIdx = STATUS_ORDER.indexOf(prev.status as DutyStatus);
            const currRowIdx = STATUS_ORDER.indexOf(curr.status as DutyStatus);
            if (prevRowIdx < 0 || currRowIdx < 0) continue;

            const x = GRID_LEFT + (curr.start_minute / 1440) * (GRID_RIGHT - GRID_LEFT);
            const y1 = GRID_TOP + prevRowIdx * ROW_H + ROW_H / 2;
            const y2 = GRID_TOP + currRowIdx * ROW_H + ROW_H / 2;

            connectors.push(<line key={`conn-${i}`} x1={x} y1={y1} x2={x} y2={y2} stroke="#555" strokeWidth={1.5} />);
          }
          return connectors;
        })()}

        {/* ── Top border ── */}
        <line x1={GRID_LEFT} y1={GRID_TOP} x2={GRID_RIGHT} y2={GRID_TOP} stroke="#888" strokeWidth={1.5} />

        {/* ── Remarks ── */}
        <text x={50} y={gridBottom + 30} fontSize={13} fontWeight={600} fill="#333">
          Remarks
        </text>
        <line x1={50} y1={gridBottom + 36} x2={W - 50} y2={gridBottom + 36} stroke="#ddd" strokeWidth={0.5} />
        {displayRemarks.map((r, i) => (
          <text key={i} x={55} y={gridBottom + 52 + i * 16} fontSize={10} fill="#555">
            {r}
          </text>
        ))}

        {/* ── Border ── */}
        <rect x={1} y={1} width={W - 2} height={dynamicHeight - 2} fill="none" stroke="#ccc" strokeWidth={1} rx={4} />
      </svg>
    </Box>
  );
}
