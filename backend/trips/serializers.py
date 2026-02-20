from rest_framework import serializers

from .models import DailySheet, DutyStatus, Segment, Stop, StopKind, TripPlan


# ---------- Input ----------
class PlanInputSerializer(serializers.Serializer):
    current_location = serializers.CharField(max_length=500)
    pickup_location = serializers.CharField(max_length=500)
    dropoff_location = serializers.CharField(max_length=500)
    cycle_used_hours = serializers.FloatField(min_value=0, max_value=70)


# ---------- Read (nested) ----------
class SegmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Segment
        fields = [
            "id",
            "start_minute",
            "end_minute",
            "status",
            "location_label",
        ]


class DailySheetSerializer(serializers.ModelSerializer):
    segments = SegmentSerializer(many=True, read_only=True)
    totals = serializers.SerializerMethodField()
    remarks = serializers.SerializerMethodField()

    class Meta:
        model = DailySheet
        fields = [
            "id",
            "date",
            "total_miles_today",
            "segments",
            "totals",
            "remarks",
        ]

    def get_totals(self, obj):
        """Sum minutes per duty status — must total 1440 (24 h)."""
        totals = {s.value: 0 for s in DutyStatus}
        for seg in obj.segments.all():
            totals[seg.status] += seg.end_minute - seg.start_minute
        return totals

    def get_remarks(self, obj):
        """Location + status at each duty-status change."""
        segments = list(obj.segments.all().order_by("start_minute"))
        remarks = []
        for i, seg in enumerate(segments):
            if i == 0 or seg.status != segments[i - 1].status:
                hours = seg.start_minute // 60
                mins = seg.start_minute % 60
                remarks.append(
                    {
                        "time": f"{hours:02d}:{mins:02d}",
                        "status": seg.status,
                        "location": seg.location_label,
                    }
                )
        return remarks


class StopSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stop
        fields = [
            "id",
            "kind",
            "lat",
            "lng",
            "label",
            "start_minute_global",
            "duration_minutes",
        ]


class TripPlanSerializer(serializers.ModelSerializer):
    daily_sheets = DailySheetSerializer(many=True, read_only=True)
    stops = StopSerializer(many=True, read_only=True)

    class Meta:
        model = TripPlan
        fields = [
            "id",
            "current_location",
            "pickup_location",
            "dropoff_location",
            "cycle_used_hours",
            "routing_provider",
            "total_miles",
            "total_drive_minutes",
            "route_polyline",
            "current_location_lat",
            "current_location_lng",
            "pickup_location_lat",
            "pickup_location_lng",
            "dropoff_location_lat",
            "dropoff_location_lng",
            "trip_completed",
            "remaining_drive_minutes",
            "planned_fuel_stops",
            "daily_sheets",
            "stops",
            "created_at",
        ]


class TripPlanListSerializer(serializers.ModelSerializer):
    """Light serializer for the list endpoint."""

    class Meta:
        model = TripPlan
        fields = [
            "id",
            "current_location",
            "pickup_location",
            "dropoff_location",
            "total_miles",
            "total_drive_minutes",
            "created_at",
        ]
