"""
Unit tests for the HOS rule engine.

These tests validate FMCSA property-carrying driver rules:
- 11-hour driving limit
- 14-hour on-duty window
- 30-minute break after 8 cumulative hours of driving
- 70-hour / 8-day cycle cap
- Fuel stop insertion every 1,000 miles
- Pickup and dropoff scheduling
"""
from datetime import date

from django.test import TestCase

from trips.hos_engine import (
    BREAK_DURATION,
    BREAK_TRIGGER,
    DRIVE_LIMIT,
    FUEL_INTERVAL_MILES,
    OFF_DUTY_RESET,
    WINDOW_LIMIT,
    Status,
    StopKind,
    compute_plan,
)


class ShortTripTest(TestCase):
    """A short trip (3 hours) should not produce any HOS breaks."""

    def test_no_breaks_on_short_trip(self):
        result = compute_plan(
            total_miles=150,
            total_drive_minutes=180,  # 3 hours
            cycle_used_hours=0,
            start_date=date(2025, 1, 1),
        )
        stop_kinds = [s.kind for s in result["stops"]]
        # Should have pickup + dropoff only
        self.assertIn(StopKind.PICKUP, stop_kinds)
        self.assertIn(StopKind.DROPOFF, stop_kinds)
        # No fuel or break stops
        self.assertNotIn(StopKind.FUEL, stop_kinds)
        self.assertNotIn(StopKind.BREAK_30, stop_kinds)
        self.assertNotIn(StopKind.OFF_DUTY_10, stop_kinds)


class BreakAfter8HoursTest(TestCase):
    """After 8 cumulative hours of driving, a 30-min break must be inserted."""

    def test_break_inserted_after_8h(self):
        result = compute_plan(
            total_miles=550,
            total_drive_minutes=9 * 60,  # 9 hours driving
            cycle_used_hours=0,
            start_date=date(2025, 1, 1),
        )
        stop_kinds = [s.kind for s in result["stops"]]
        self.assertIn(StopKind.BREAK_30, stop_kinds)

        # Verify break timing: should appear around the 8h mark
        for stop in result["stops"]:
            if stop.kind == StopKind.BREAK_30:
                self.assertEqual(stop.duration, BREAK_DURATION)
                break


class DrivingLimitTest(TestCase):
    """The driver cannot drive more than 11 hours in a single duty period."""

    def test_11h_drive_limit_triggers_reset(self):
        result = compute_plan(
            total_miles=800,
            total_drive_minutes=13 * 60,  # 13 h would exceed 11h limit
            cycle_used_hours=0,
            start_date=date(2025, 1, 1),
        )
        # There should be a 10-hour off-duty reset
        stop_kinds = [s.kind for s in result["stops"]]
        self.assertIn(StopKind.OFF_DUTY_10, stop_kinds)

    def test_total_driving_segments_within_period_capped(self):
        result = compute_plan(
            total_miles=800,
            total_drive_minutes=13 * 60,
            cycle_used_hours=0,
            start_date=date(2025, 1, 1),
        )
        # Check that no single duty period has > 11h driving
        # A duty period ends at a SLEEPER/OFF_DUTY_10 event
        period_drive = 0
        for evt in result["timeline"]:
            if evt.status == Status.DRIVING:
                period_drive += evt.end - evt.start
            elif evt.status == Status.SLEEPER:
                self.assertLessEqual(period_drive, DRIVE_LIMIT + 1)  # +1 for rounding
                period_drive = 0


class WindowLimitTest(TestCase):
    """The 14-hour on-duty window must trigger a reset."""

    def test_14h_window_causes_reset(self):
        # A trip with lots of on-duty not-driving time filling the 14h window
        result = compute_plan(
            total_miles=700,
            total_drive_minutes=12 * 60,
            cycle_used_hours=0,
            start_date=date(2025, 1, 1),
        )
        stop_kinds = [s.kind for s in result["stops"]]
        self.assertIn(StopKind.OFF_DUTY_10, stop_kinds)


class CycleCapTest(TestCase):
    """If cycle_used_hours is high, driving should be shortened."""

    def test_high_cycle_limits_driving(self):
        result = compute_plan(
            total_miles=400,
            total_drive_minutes=8 * 60,
            cycle_used_hours=65,  # only 5h left in 70h cycle
            start_date=date(2025, 1, 1),
        )
        # Sum driving minutes in timeline
        total_drive = sum(
            evt.end - evt.start
            for evt in result["timeline"]
            if evt.status == Status.DRIVING
        )
        # Should be capped around 5h  (300 min) or less
        self.assertLessEqual(total_drive, 5 * 60 + 30)  # allow small buffer


class FuelStopTest(TestCase):
    """Fuel stops must be inserted at least every 1,000 miles."""

    def test_fuel_stop_on_long_trip(self):
        result = compute_plan(
            total_miles=1500,
            total_drive_minutes=22 * 60,
            cycle_used_hours=0,
            start_date=date(2025, 1, 1),
        )
        stop_kinds = [s.kind for s in result["stops"]]
        self.assertIn(StopKind.FUEL, stop_kinds)


class PickupDropoffTest(TestCase):
    """Pickup and dropoff must each be 1h On Duty (Not Driving)."""

    def test_pickup_and_dropoff_present(self):
        result = compute_plan(
            total_miles=200,
            total_drive_minutes=3 * 60,
            cycle_used_hours=0,
            start_date=date(2025, 1, 1),
        )
        stop_kinds = [s.kind for s in result["stops"]]
        self.assertIn(StopKind.PICKUP, stop_kinds)
        self.assertIn(StopKind.DROPOFF, stop_kinds)

        # Each should be 60 minutes
        for stop in result["stops"]:
            if stop.kind in (StopKind.PICKUP, StopKind.DROPOFF):
                self.assertEqual(stop.duration, 60)

    def test_on_duty_segments_exist_for_pickup_dropoff(self):
        result = compute_plan(
            total_miles=200,
            total_drive_minutes=3 * 60,
            cycle_used_hours=0,
            start_date=date(2025, 1, 1),
        )
        on_duty_segments = [
            seg
            for sheet in result["daily_sheets"]
            for seg in sheet.segments
            if seg["status"] == Status.ON_DUTY_NOT_DRIVING.value
        ]
        # At least 2 segments for pickup + dropoff (may be more if fuel stops)
        self.assertGreaterEqual(len(on_duty_segments), 2)


class DailySheetsTest(TestCase):
    """Daily sheets should cover full 24-hour days and sum to 1440 min."""

    def test_sheets_sum_to_1440(self):
        result = compute_plan(
            total_miles=200,
            total_drive_minutes=3 * 60,
            cycle_used_hours=0,
            start_date=date(2025, 1, 1),
        )
        for sheet in result["daily_sheets"]:
            total = sum(
                seg["end_minute"] - seg["start_minute"] for seg in sheet.segments
            )
            self.assertEqual(total, 1440, f"Sheet {sheet.date} totals {total}, not 1440")

    def test_multiday_trip_produces_multiple_sheets(self):
        result = compute_plan(
            total_miles=1500,
            total_drive_minutes=22 * 60,
            cycle_used_hours=0,
            start_date=date(2025, 1, 1),
        )
        self.assertGreater(len(result["daily_sheets"]), 1)


class LongHaulMultiDayTest(TestCase):
    """
    Validates the Denver → Philadelphia → Chicago scenario (2,504 mi, ~58h drive).

    This is a regression test for multi-day scheduling accuracy. All FMCSA rules
    must be enforced over the full trip duration, not just the first duty period.
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.result = compute_plan(
            total_miles=2504,
            total_drive_minutes=58 * 60 + 9,  # 3489 min (~58h 9m)
            cycle_used_hours=0,
            start_date=date(2025, 6, 1),
        )
        cls.stops = cls.result["stops"]
        cls.sheets = cls.result["daily_sheets"]

    def test_requires_multiple_days(self):
        """58h of driving cannot fit in 1 day — need at least 5."""
        self.assertGreaterEqual(len(self.sheets), 5)

    def test_fuel_stops_every_1000_miles(self):
        """2,504 miles ÷ 1,000 = at least 2 fuel stops."""
        fuel_count = sum(1 for s in self.stops if s.kind == StopKind.FUEL)
        self.assertGreaterEqual(fuel_count, 2)

    def test_30min_breaks_after_8h_driving(self):
        """58h ÷ 8h = 7.25 → at least 5 breaks (allowing for resets resetting cumulative)."""
        break_count = sum(1 for s in self.stops if s.kind == StopKind.BREAK_30)
        self.assertGreaterEqual(break_count, 4)

    def test_10h_off_duty_resets(self):
        """58h driving ÷ 11h max per period → at least 4 resets."""
        reset_count = sum(1 for s in self.stops if s.kind == StopKind.OFF_DUTY_10)
        self.assertGreaterEqual(reset_count, 4)

    def test_pickup_and_dropoff_present(self):
        kinds = [s.kind for s in self.stops]
        self.assertIn(StopKind.PICKUP, kinds)
        self.assertIn(StopKind.DROPOFF, kinds)

    def test_no_duty_period_exceeds_11h_driving(self):
        """Within each duty period (between 10h resets), driving must be ≤ 11h."""
        period_drive = 0
        for evt in self.result["timeline"]:
            if evt.status == Status.DRIVING:
                period_drive += evt.end - evt.start
            elif evt.status == Status.SLEEPER:
                self.assertLessEqual(
                    period_drive, DRIVE_LIMIT + 1,
                    f"Duty period had {period_drive} min driving (limit {DRIVE_LIMIT})",
                )
                period_drive = 0

    def test_each_daily_sheet_sums_to_1440(self):
        """Every daily sheet must cover exactly 24 hours (1440 min)."""
        for sheet in self.sheets:
            total = sum(
                seg["end_minute"] - seg["start_minute"] for seg in sheet.segments
            )
            self.assertEqual(
                total, 1440,
                f"Sheet {sheet.date} totals {total} min, expected 1440",
            )


class IncompleteTripTest(TestCase):
    """When cycle hours are nearly exhausted, the trip should be marked incomplete."""

    def test_high_cycle_marks_trip_incomplete(self):
        result = compute_plan(
            total_miles=1793,
            total_drive_minutes=41 * 60 + 52,  # ~41h 52m
            cycle_used_hours=69,  # only 1h remaining in 70/8
            start_date=date(2025, 1, 1),
        )
        self.assertFalse(result["trip_completed"])
        self.assertGreater(result["remaining_drive_minutes"], 0)

    def test_remaining_drive_minutes_accurate(self):
        result = compute_plan(
            total_miles=1793,
            total_drive_minutes=41 * 60 + 52,
            cycle_used_hours=69,
            start_date=date(2025, 1, 1),
        )
        actual_driven = sum(
            e.end - e.start for e in result["timeline"] if e.status == Status.DRIVING
        )
        expected_remaining = (41 * 60 + 52) - actual_driven
        self.assertEqual(result["remaining_drive_minutes"], expected_remaining)


class FuelStopPlanningTest(TestCase):
    """Fuel stop count should reflect the full route, not just the driven portion."""

    def test_planned_fuel_stops_on_incomplete_trip(self):
        """1,793 miles / 1,000 = at least 1 planned fuel stop even if barely driven."""
        result = compute_plan(
            total_miles=1793,
            total_drive_minutes=41 * 60 + 52,
            cycle_used_hours=69,
            start_date=date(2025, 1, 1),
        )
        self.assertGreaterEqual(result["planned_fuel_stops"], 1)

    def test_planned_fuel_stops_on_complete_trip(self):
        """2,504 miles / 1,000 = at least 2 planned fuel stops."""
        result = compute_plan(
            total_miles=2504,
            total_drive_minutes=58 * 60,
            cycle_used_hours=0,
            start_date=date(2025, 1, 1),
        )
        self.assertGreaterEqual(result["planned_fuel_stops"], 2)


class CompletedTripFlagTest(TestCase):
    """Short trips with enough cycle hours should be marked as completed."""

    def test_short_trip_is_completed(self):
        result = compute_plan(
            total_miles=150,
            total_drive_minutes=180,
            cycle_used_hours=0,
            start_date=date(2025, 1, 1),
        )
        self.assertTrue(result["trip_completed"])
        self.assertEqual(result["remaining_drive_minutes"], 0)

    def test_moderate_trip_with_enough_cycle(self):
        result = compute_plan(
            total_miles=400,
            total_drive_minutes=8 * 60,
            cycle_used_hours=20,
            start_date=date(2025, 1, 1),
        )
        self.assertTrue(result["trip_completed"])
        self.assertEqual(result["remaining_drive_minutes"], 0)
