"""
API views for trip planning.
"""
import logging
import math
from datetime import date

import polyline as polyline_codec
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from . import hos_engine, routing_client
from .models import DailySheet, Segment, Stop, TripPlan
from .serializers import (
    PlanInputSerializer,
    TripPlanListSerializer,
    TripPlanSerializer,
)

logger = logging.getLogger(__name__)


# ── Polyline interpolation helper ────────────────────────────────────
def _interpolate_stop_positions(plan_result, encoded_polyline, total_drive_minutes):
    """
    Compute lat/lng for each stop by interpolating along the route polyline.

    Uses the stop's driving-time position (how much driving has elapsed)
    relative to total driving time to find a fractional position along the
    decoded polyline.
    """
    if not encoded_polyline or total_drive_minutes <= 0:
        return

    decoded = polyline_codec.decode(encoded_polyline)  # list of (lat, lng)
    if len(decoded) < 2:
        return

    # Pre-compute cumulative segment lengths for the polyline
    seg_lengths = []
    total_length = 0.0
    for i in range(1, len(decoded)):
        dlat = decoded[i][0] - decoded[i - 1][0]
        dlng = decoded[i][1] - decoded[i - 1][1]
        d = math.sqrt(dlat ** 2 + dlng ** 2)
        seg_lengths.append(d)
        total_length += d

    if total_length <= 0:
        return

    # Build a lookup: for each stop, compute how many driving minutes
    # have elapsed by the time it starts.
    timeline = plan_result["timeline"]
    for stop_evt in plan_result["stops"]:
        if stop_evt.lat != 0 or stop_evt.lng != 0:
            continue  # already has coords (pickup/dropoff)

        # Sum driving minutes before this stop
        driving_before = 0
        for evt in timeline:
            if evt.start >= stop_evt.global_minute:
                break
            if evt.status.value == "DRIVING":
                end = min(evt.end, stop_evt.global_minute)
                driving_before += end - evt.start

        # Fraction along the route
        frac = min(driving_before / total_drive_minutes, 1.0)
        target_dist = frac * total_length

        # Walk polyline segments to find interpolated position
        cumulative = 0.0
        for i, sl in enumerate(seg_lengths):
            if cumulative + sl >= target_dist:
                # Interpolate within this segment
                remaining = target_dist - cumulative
                ratio = remaining / sl if sl > 0 else 0
                lat = decoded[i][0] + ratio * (decoded[i + 1][0] - decoded[i][0])
                lng = decoded[i][1] + ratio * (decoded[i + 1][1] - decoded[i][1])
                stop_evt.lat = round(lat, 6)
                stop_evt.lng = round(lng, 6)
                break
            cumulative += sl
        else:
            # Past the end — use last point
            stop_evt.lat = decoded[-1][0]
            stop_evt.lng = decoded[-1][1]


@api_view(["POST"])
def create_plan(request):
    """
    POST /api/plan

    Body: { current_location, pickup_location, dropoff_location, cycle_used_hours }
    Returns: full trip plan with route, stops, and daily sheets.
    """
    serializer = PlanInputSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    try:
        # ── 1. Use provided coordinates or fall back to geocoding ────
        if data.get("current_lat") is not None and data.get("current_lng") is not None:
            cur_lat, cur_lng = data["current_lat"], data["current_lng"]
        else:
            cur_lng, cur_lat = routing_client.geocode(data["current_location"])

        if data.get("pickup_lat") is not None and data.get("pickup_lng") is not None:
            pickup_lat, pickup_lng = data["pickup_lat"], data["pickup_lng"]
        else:
            pickup_lng, pickup_lat = routing_client.geocode(data["pickup_location"])

        if data.get("dropoff_lat") is not None and data.get("dropoff_lng") is not None:
            dropoff_lat, dropoff_lng = data["dropoff_lat"], data["dropoff_lng"]
        else:
            dropoff_lng, dropoff_lat = routing_client.geocode(data["dropoff_location"])

        # ── 2. Get driving directions (current → pickup → dropoff) ───
        waypoints = [
            (cur_lng, cur_lat),
            (pickup_lng, pickup_lat),
            (dropoff_lng, dropoff_lat),
        ]
        route = routing_client.get_directions(waypoints)

        total_miles = route["distance_miles"]
        total_drive_minutes = int(route["duration_minutes"])
        encoded_polyline = route["geometry"]

        # ── 2b. Extract real leg distances from routing API ──────────
        legs = route.get("legs", [])
        if len(legs) >= 2:
            leg1_miles = legs[0]["distance_miles"]
            leg1_minutes = int(legs[0]["duration_minutes"])
            leg2_miles = legs[1]["distance_miles"]
            leg2_minutes = int(legs[1]["duration_minutes"])
        else:
            # Fallback: use 30/70 split if legs not available
            leg1_miles = total_miles * 0.30
            leg1_minutes = int(total_drive_minutes * 0.30)
            leg2_miles = total_miles - leg1_miles
            leg2_minutes = total_drive_minutes - leg1_minutes

        # ── 3. Run HOS engine ────────────────────────────────────────
        plan_result = hos_engine.compute_plan(
            total_miles=total_miles,
            total_drive_minutes=total_drive_minutes,
            cycle_used_hours=data["cycle_used_hours"],
            pickup_label=data["pickup_location"],
            dropoff_label=data["dropoff_location"],
            pickup_coords=(pickup_lat, pickup_lng),
            dropoff_coords=(dropoff_lat, dropoff_lng),
            start_date=date.today(),
            leg1_miles=leg1_miles,
            leg1_minutes=leg1_minutes,
            leg2_miles=leg2_miles,
            leg2_minutes=leg2_minutes,
        )

        # ── 3b. Interpolate stop positions along polyline ────────────
        _interpolate_stop_positions(plan_result, encoded_polyline, total_drive_minutes)

        # ── 4. Persist ───────────────────────────────────────────────
        trip = TripPlan.objects.create(
            current_location=data["current_location"],
            pickup_location=data["pickup_location"],
            dropoff_location=data["dropoff_location"],
            cycle_used_hours=data["cycle_used_hours"],
            total_miles=round(total_miles, 1),
            total_drive_minutes=total_drive_minutes,
            route_polyline=encoded_polyline,
            current_location_lat=cur_lat,
            current_location_lng=cur_lng,
            pickup_location_lat=pickup_lat,
            pickup_location_lng=pickup_lng,
            dropoff_location_lat=dropoff_lat,
            dropoff_location_lng=dropoff_lng,
            trip_completed=plan_result["trip_completed"],
            remaining_drive_minutes=plan_result["remaining_drive_minutes"],
            planned_fuel_stops=plan_result["planned_fuel_stops"],
        )

        # Persist stops
        for stop_evt in plan_result["stops"]:
            Stop.objects.create(
                trip_plan=trip,
                kind=stop_evt.kind.value,
                lat=stop_evt.lat,
                lng=stop_evt.lng,
                label=stop_evt.label,
                start_minute_global=stop_evt.global_minute,
                duration_minutes=stop_evt.duration,
            )

        # Persist daily sheets + segments
        for sheet_data in plan_result["daily_sheets"]:
            sheet = DailySheet.objects.create(
                trip_plan=trip,
                date=sheet_data.date,
                total_miles_today=sheet_data.total_miles,
            )
            for seg in sheet_data.segments:
                Segment.objects.create(
                    daily_sheet=sheet,
                    start_minute=seg["start_minute"],
                    end_minute=seg["end_minute"],
                    status=seg["status"],
                    location_label=seg["location_label"],
                )

        # ── 5. Return full response ──────────────────────────────────
        result_serializer = TripPlanSerializer(trip)
        return Response(result_serializer.data, status=status.HTTP_201_CREATED)

    except ValueError as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception as e:
        logger.exception("Error creating trip plan")
        return Response(
            {"error": f"Failed to create trip plan: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
def list_plans(request):
    """GET /api/plans — list saved plans (summary)."""
    plans = TripPlan.objects.all()
    serializer = TripPlanListSerializer(plans, many=True)
    return Response(serializer.data)


@api_view(["GET"])
def get_plan(request, plan_id):
    """GET /api/plans/<uuid> — full plan with sheets/segments/stops."""
    try:
        plan = TripPlan.objects.get(id=plan_id)
    except TripPlan.DoesNotExist:
        return Response(
            {"error": "Plan not found"},
            status=status.HTTP_404_NOT_FOUND,
        )
    serializer = TripPlanSerializer(plan)
    return Response(serializer.data)
