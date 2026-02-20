"""
HOS (Hours of Service) Rule Engine.

Implements FMCSA property-carrying driver rules:
- 11-hour driving limit in a 14-hour on-duty window
- 30-minute break after 8 cumulative driving hours
- 70-hour / 8-day rolling cycle limit
- 10-hour off-duty reset between duty periods
- Fuel stops every 1,000 miles
- 1-hour On Duty Not Driving for pickup & dropoff

The engine is deterministic: given the same inputs it always produces
the same schedule.  All times are in **minutes**.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date, timedelta
from enum import Enum


# ── Constants ────────────────────────────────────────────────────────
DRIVE_LIMIT = 11 * 60           # 660 min
WINDOW_LIMIT = 14 * 60          # 840 min
BREAK_TRIGGER = 8 * 60          # 480 min cumulative driving
BREAK_DURATION = 30             # min
OFF_DUTY_RESET = 10 * 60        # 600 min
CYCLE_LIMIT = 70 * 60           # 4200 min
FUEL_INTERVAL_MILES = 1000
FUEL_DURATION = 30              # min  (On Duty Not Driving)
PICKUP_DURATION = 60            # min
DROPOFF_DURATION = 60           # min
AVG_SPEED_MPH = 55              # used to estimate distance per time block
MINUTES_IN_DAY = 1440


class Status(str, Enum):
    OFF_DUTY = "OFF_DUTY"
    SLEEPER = "SLEEPER"
    DRIVING = "DRIVING"
    ON_DUTY_NOT_DRIVING = "ON_DUTY_NOT_DRIVING"


class StopKind(str, Enum):
    FUEL = "FUEL"
    BREAK_30 = "BREAK_30"
    OFF_DUTY_10 = "OFF_DUTY_10"
    PICKUP = "PICKUP"
    DROPOFF = "DROPOFF"


# ── Data classes ─────────────────────────────────────────────────────
@dataclass
class TimelineEvent:
    """One contiguous block on the global timeline (minutes from trip start)."""
    start: int          # global minute
    end: int            # global minute
    status: Status
    label: str = ""
    miles: float = 0.0


@dataclass
class StopEvent:
    kind: StopKind
    global_minute: int
    duration: int
    label: str = ""
    lat: float = 0.0
    lng: float = 0.0


@dataclass
class DaySheet:
    date: date
    segments: list  # list of {start_minute, end_minute, status, location_label}
    total_miles: float = 0.0


@dataclass
class DriverState:
    """Mutable state tracked as the engine simulates the trip."""
    global_minute: int = 0
    drive_minutes: int = 0          # in current duty period
    on_duty_minutes: int = 0        # in current 14h window
    cumulative_drive: int = 0       # since last 30-min break
    cycle_minutes: float = 0        # total on-duty + driving in 70/8 window
    miles_since_fuel: float = 0.0
    timeline: list = field(default_factory=list)
    stops: list = field(default_factory=list)


# ── Public API ───────────────────────────────────────────────────────
def compute_plan(
    total_miles: float,
    total_drive_minutes: int,
    cycle_used_hours: float,
    pickup_label: str = "Pickup",
    dropoff_label: str = "Dropoff",
    pickup_coords: tuple[float, float] = (0, 0),
    dropoff_coords: tuple[float, float] = (0, 0),
    start_date: date | None = None,
    leg1_miles: float | None = None,
    leg1_minutes: int | None = None,
    leg2_miles: float | None = None,
    leg2_minutes: int | None = None,
) -> dict:
    """
    Build a full HOS-compliant plan.

    Parameters
    ----------
    leg1_miles, leg1_minutes : optional
        Actual distance/time for current → pickup leg from routing API.
    leg2_miles, leg2_minutes : optional
        Actual distance/time for pickup → dropoff leg from routing API.
        If not provided, falls back to a 30/70 split.

    Returns
    -------
    dict with keys:
        timeline   : list[TimelineEvent]
        stops      : list[StopEvent]
        daily_sheets : list[DaySheet]
    """
    if start_date is None:
        from datetime import date as _date
        start_date = _date.today()

    state = DriverState(cycle_minutes=int(cycle_used_hours * 60))

    # ── Phase 1: Drive current → pickup ──────────────────────────────
    # Use real leg distances from routing API, or fallback to 30/70 split
    if leg1_miles is not None and leg1_minutes is not None:
        _leg1_miles = leg1_miles
        _leg1_minutes = leg1_minutes
    else:
        leg1_fraction = 0.30
        _leg1_miles = total_miles * leg1_fraction
        _leg1_minutes = int(total_drive_minutes * leg1_fraction)

    if leg2_miles is not None and leg2_minutes is not None:
        _leg2_miles = leg2_miles
        _leg2_minutes = leg2_minutes
    else:
        _leg2_miles = total_miles - _leg1_miles
        _leg2_minutes = total_drive_minutes - _leg1_minutes

    _drive_leg(state, _leg1_miles, _leg1_minutes, "En route to pickup")

    # ── Pickup (1 h On Duty Not Driving) ─────────────────────────────
    _insert_on_duty_stop(state, PICKUP_DURATION, StopKind.PICKUP, pickup_label,
                         pickup_coords[0], pickup_coords[1])

    # ── Phase 2: Drive pickup → dropoff ──────────────────────────────
    _drive_leg(state, _leg2_miles, _leg2_minutes, "En route to dropoff")

    # ── Dropoff (1 h On Duty Not Driving) ────────────────────────────
    _insert_on_duty_stop(state, DROPOFF_DURATION, StopKind.DROPOFF, dropoff_label,
                         dropoff_coords[0], dropoff_coords[1])

    # ── Fill remainder of last day with Off Duty ─────────────────────
    day_minute = state.global_minute % MINUTES_IN_DAY
    if day_minute > 0:
        remaining = MINUTES_IN_DAY - day_minute
        state.timeline.append(
            TimelineEvent(
                start=state.global_minute,
                end=state.global_minute + remaining,
                status=Status.OFF_DUTY,
                label="Off Duty",
            )
        )
        state.global_minute += remaining

    # ── Determine trip completion status ──────────────────────────────
    actual_driven_minutes = sum(
        e.end - e.start for e in state.timeline if e.status == Status.DRIVING
    )
    remaining_drive = max(0, total_drive_minutes - actual_driven_minutes)
    trip_completed = remaining_drive <= 0

    # ── Calculate planned fuel stops for the full route ───────────────
    num_fuel_needed = max(0, int(total_miles / FUEL_INTERVAL_MILES))
    actual_fuel_stops = sum(1 for s in state.stops if s.kind == StopKind.FUEL)
    planned_fuel_stops = max(num_fuel_needed, actual_fuel_stops)

    # ── Build daily sheets from timeline ─────────────────────────────
    daily_sheets = _build_daily_sheets(state.timeline, start_date)

    return {
        "timeline": state.timeline,
        "stops": state.stops,
        "daily_sheets": daily_sheets,
        "trip_completed": trip_completed,
        "remaining_drive_minutes": remaining_drive,
        "planned_fuel_stops": planned_fuel_stops,
    }


# ── Internal helpers ─────────────────────────────────────────────────
def _drive_leg(state: DriverState, miles: float, minutes: int, label: str):
    """Simulate driving a leg, inserting breaks / resets as needed."""
    remaining_miles = miles
    remaining_minutes = minutes

    while remaining_minutes > 0:
        # ── Check cycle limit ────────────────────────────────────────
        cycle_remaining = max(0, CYCLE_LIMIT - state.cycle_minutes)
        if cycle_remaining <= 0:
            # Cycle exhausted — cannot drive any more
            break

        # ── Check if daily reset needed (14h window) ─────────────────
        window_remaining = max(0, WINDOW_LIMIT - state.on_duty_minutes)
        drive_remaining = max(0, DRIVE_LIMIT - state.drive_minutes)

        if window_remaining <= 0 or drive_remaining <= 0:
            _insert_reset(state)
            continue

        # ── Check 30-min break after 8h cumulative driving ───────────
        if state.cumulative_drive >= BREAK_TRIGGER:
            _insert_break(state, label)
            continue

        # ── Check fuel ───────────────────────────────────────────────
        if state.miles_since_fuel >= FUEL_INTERVAL_MILES:
            _insert_fuel_stop(state, label)
            continue

        # ── Calculate drivable chunk ─────────────────────────────────
        max_drive = min(
            remaining_minutes,
            drive_remaining,
            window_remaining,
            cycle_remaining,
            BREAK_TRIGGER - state.cumulative_drive,  # until break needed
        )

        # Check fuel distance
        if remaining_minutes > 0:
            speed = remaining_miles / remaining_minutes * 60  # mph
        else:
            speed = AVG_SPEED_MPH
        miles_until_fuel = FUEL_INTERVAL_MILES - state.miles_since_fuel
        minutes_until_fuel = int(miles_until_fuel / max(speed, 1) * 60) if speed > 0 else max_drive
        max_drive = min(max_drive, max(1, minutes_until_fuel))

        if max_drive <= 0:
            max_drive = 1  # safety: advance at least 1 minute

        # ── Drive ────────────────────────────────────────────────────
        chunk_miles = (max_drive / max(remaining_minutes, 1)) * remaining_miles
        state.timeline.append(
            TimelineEvent(
                start=state.global_minute,
                end=state.global_minute + max_drive,
                status=Status.DRIVING,
                label=label,
                miles=chunk_miles,
            )
        )
        state.global_minute += max_drive
        state.drive_minutes += max_drive
        state.on_duty_minutes += max_drive
        state.cumulative_drive += max_drive
        state.cycle_minutes += max_drive
        state.miles_since_fuel += chunk_miles

        remaining_minutes -= max_drive
        remaining_miles -= chunk_miles


def _insert_break(state: DriverState, label: str):
    """Insert a mandatory 30-minute break (Off Duty)."""
    state.stops.append(
        StopEvent(
            kind=StopKind.BREAK_30,
            global_minute=state.global_minute,
            duration=BREAK_DURATION,
            label=f"30-min break — {label}",
        )
    )
    state.timeline.append(
        TimelineEvent(
            start=state.global_minute,
            end=state.global_minute + BREAK_DURATION,
            status=Status.OFF_DUTY,
            label="30-min break",
        )
    )
    state.global_minute += BREAK_DURATION
    state.on_duty_minutes += BREAK_DURATION  # counts toward 14h window
    state.cumulative_drive = 0  # break resets the 8h counter


def _insert_reset(state: DriverState):
    """Insert 10-hour off-duty reset and start a new duty period."""
    state.stops.append(
        StopEvent(
            kind=StopKind.OFF_DUTY_10,
            global_minute=state.global_minute,
            duration=OFF_DUTY_RESET,
            label="10-hour off-duty reset",
        )
    )
    state.timeline.append(
        TimelineEvent(
            start=state.global_minute,
            end=state.global_minute + OFF_DUTY_RESET,
            status=Status.SLEEPER,
            label="10-hour sleeper berth reset",
        )
    )
    state.global_minute += OFF_DUTY_RESET
    # Reset counters for new duty period
    state.drive_minutes = 0
    state.on_duty_minutes = 0
    state.cumulative_drive = 0


def _insert_fuel_stop(state: DriverState, label: str):
    """Insert a fuel stop (On Duty Not Driving)."""
    state.stops.append(
        StopEvent(
            kind=StopKind.FUEL,
            global_minute=state.global_minute,
            duration=FUEL_DURATION,
            label=f"Fuel stop — {label}",
        )
    )
    state.timeline.append(
        TimelineEvent(
            start=state.global_minute,
            end=state.global_minute + FUEL_DURATION,
            status=Status.ON_DUTY_NOT_DRIVING,
            label="Fuel stop",
        )
    )
    state.global_minute += FUEL_DURATION
    state.on_duty_minutes += FUEL_DURATION
    state.cycle_minutes += FUEL_DURATION
    state.miles_since_fuel = 0


def _insert_on_duty_stop(
    state: DriverState,
    duration: int,
    kind: StopKind,
    label: str,
    lat: float = 0,
    lng: float = 0,
):
    """Insert a pickup/dropoff On Duty (Not Driving) stop."""
    # Check if we need a reset before this on-duty block
    window_remaining = WINDOW_LIMIT - state.on_duty_minutes
    if window_remaining < duration:
        _insert_reset(state)

    state.stops.append(
        StopEvent(
            kind=kind,
            global_minute=state.global_minute,
            duration=duration,
            label=label,
            lat=lat,
            lng=lng,
        )
    )
    state.timeline.append(
        TimelineEvent(
            start=state.global_minute,
            end=state.global_minute + duration,
            status=Status.ON_DUTY_NOT_DRIVING,
            label=label,
        )
    )
    state.global_minute += duration
    state.on_duty_minutes += duration
    state.cycle_minutes += duration


def _build_daily_sheets(
    timeline: list[TimelineEvent], start_date: date
) -> list[DaySheet]:
    """
    Slice the global timeline into per-day sheets (0–1440 min each).
    """
    if not timeline:
        return []

    total_minutes = timeline[-1].end
    num_days = math.ceil(total_minutes / MINUTES_IN_DAY)

    sheets: list[DaySheet] = []

    for day_idx in range(num_days):
        day_start = day_idx * MINUTES_IN_DAY
        day_end = day_start + MINUTES_IN_DAY
        current_date = start_date + timedelta(days=day_idx)
        segments = []
        day_miles = 0.0

        for evt in timeline:
            # Skip events not overlapping this day
            if evt.end <= day_start or evt.start >= day_end:
                continue
            seg_start = max(evt.start, day_start) - day_start
            seg_end = min(evt.end, day_end) - day_start
            if seg_start >= seg_end:
                continue

            # Proportion of miles in this day slice
            evt_duration = evt.end - evt.start
            if evt_duration > 0 and evt.miles > 0:
                fraction = (seg_end - seg_start) / evt_duration
                day_miles += evt.miles * fraction

            segments.append(
                {
                    "start_minute": seg_start,
                    "end_minute": seg_end,
                    "status": evt.status.value,
                    "location_label": evt.label,
                }
            )

        # Merge adjacent segments with the same status
        merged = _merge_segments(segments)

        sheets.append(
            DaySheet(date=current_date, segments=merged, total_miles=round(day_miles, 1))
        )

    return sheets


def _merge_segments(segments: list[dict]) -> list[dict]:
    """Merge consecutive segments with the same status."""
    if not segments:
        return []
    merged = [segments[0].copy()]
    for seg in segments[1:]:
        if (
            seg["status"] == merged[-1]["status"]
            and seg["start_minute"] == merged[-1]["end_minute"]
        ):
            merged[-1]["end_minute"] = seg["end_minute"]
            # keep the label from the later segment if non-empty
            if seg["location_label"]:
                merged[-1]["location_label"] = seg["location_label"]
        else:
            merged.append(seg.copy())
    return merged
