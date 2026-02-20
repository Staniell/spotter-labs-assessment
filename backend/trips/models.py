import uuid

from django.db import models


class StopKind(models.TextChoices):
    FUEL = "FUEL", "Fuel Stop"
    BREAK_30 = "BREAK_30", "30-Min Break"
    OFF_DUTY_10 = "OFF_DUTY_10", "10-Hour Off Duty"
    PICKUP = "PICKUP", "Pickup"
    DROPOFF = "DROPOFF", "Dropoff"


class DutyStatus(models.TextChoices):
    OFF_DUTY = "OFF_DUTY", "Off Duty"
    SLEEPER = "SLEEPER", "Sleeper Berth"
    DRIVING = "DRIVING", "Driving"
    ON_DUTY_NOT_DRIVING = "ON_DUTY_NOT_DRIVING", "On Duty (Not Driving)"


class TripPlan(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    current_location = models.CharField(max_length=500)
    pickup_location = models.CharField(max_length=500)
    dropoff_location = models.CharField(max_length=500)
    cycle_used_hours = models.FloatField(help_text="Hours already used in the 70/8 cycle")
    routing_provider = models.CharField(max_length=50, default="openrouteservice")
    total_miles = models.FloatField(default=0)
    total_drive_minutes = models.IntegerField(default=0)
    route_polyline = models.TextField(
        blank=True, default="", help_text="Encoded polyline geometry"
    )
    current_location_lat = models.FloatField(default=0)
    current_location_lng = models.FloatField(default=0)
    pickup_location_lat = models.FloatField(default=0)
    pickup_location_lng = models.FloatField(default=0)
    dropoff_location_lat = models.FloatField(default=0)
    dropoff_location_lng = models.FloatField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Trip {self.id}: {self.current_location} → {self.dropoff_location}"


class Stop(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trip_plan = models.ForeignKey(TripPlan, on_delete=models.CASCADE, related_name="stops")
    kind = models.CharField(max_length=20, choices=StopKind.choices)
    lat = models.FloatField()
    lng = models.FloatField()
    label = models.CharField(max_length=500, blank=True, default="")
    start_minute_global = models.IntegerField(
        help_text="Minutes since trip start when this stop begins"
    )
    duration_minutes = models.IntegerField()

    class Meta:
        ordering = ["start_minute_global"]

    def __str__(self):
        return f"{self.kind} at min {self.start_minute_global}"


class DailySheet(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trip_plan = models.ForeignKey(
        TripPlan, on_delete=models.CASCADE, related_name="daily_sheets"
    )
    date = models.DateField()
    total_miles_today = models.FloatField(default=0)

    class Meta:
        ordering = ["date"]

    def __str__(self):
        return f"Sheet {self.date} for trip {self.trip_plan_id}"


class Segment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daily_sheet = models.ForeignKey(
        DailySheet, on_delete=models.CASCADE, related_name="segments"
    )
    start_minute = models.IntegerField(help_text="0–1440, minutes from midnight")
    end_minute = models.IntegerField(help_text="0–1440, minutes from midnight")
    status = models.CharField(max_length=25, choices=DutyStatus.choices)
    location_label = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        ordering = ["start_minute"]

    def __str__(self):
        return f"{self.status} {self.start_minute}–{self.end_minute}"
