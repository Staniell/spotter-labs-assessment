"""
OpenRouteService routing client.

Provides geocoding and directions via the ORS REST API.
Uses the ``openrouteservice`` Python SDK.
"""
import logging

import openrouteservice
from django.conf import settings

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is None:
        api_key = settings.ORS_API_KEY
        if not api_key:
            raise ValueError(
                "ORS_API_KEY is not set. Add it to your .env file. "
                "Get a free key at https://openrouteservice.org/dev/#/signup"
            )
        _client = openrouteservice.Client(key=api_key)
    return _client


def geocode(address: str) -> tuple[float, float]:
    """
    Geocode an address string → (lng, lat).
    Returns (longitude, latitude) as ORS uses [lng, lat] ordering.
    """
    client = _get_client()
    result = client.pelias_search(text=address)
    if not result.get("features"):
        raise ValueError(f"Could not geocode address: {address}")
    coords = result["features"][0]["geometry"]["coordinates"]
    return coords[0], coords[1]  # lng, lat


def get_directions(coordinates: list[tuple[float, float]]) -> dict:
    """
    Get driving directions between ordered waypoints.

    Parameters
    ----------
    coordinates : list of (lng, lat) tuples

    Returns
    -------
    dict with keys:
        distance_miles : float
        duration_minutes : float
        geometry : str   (encoded polyline)
        legs : list of {distance_miles, duration_minutes}
        bbox : list      [min_lng, min_lat, max_lng, max_lat]
    """
    client = _get_client()

    result = client.directions(
        coordinates=coordinates,
        profile="driving-hgv",
        format="json",
        units="mi",
        geometry=True,
        instructions=False,
    )

    route = result["routes"][0]
    summary = route["summary"]

    legs = []
    for segment in route.get("segments", []):
        legs.append(
            {
                "distance_miles": segment["distance"],
                "duration_minutes": segment["duration"] / 60,
            }
        )

    return {
        "distance_miles": summary["distance"],
        "duration_minutes": summary["duration"] / 60,
        "geometry": route["geometry"],
        "legs": legs,
        "bbox": route.get("bbox", []),
    }
