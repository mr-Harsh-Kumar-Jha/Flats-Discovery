"""
Commute & Spatial Engine for Pune-Flats Pipeline.
Calculates real spatial distances, walk times to nearest transit stations,
and drive/transit commute times to key tech hubs without hardcoding.
"""

import math
from typing import Dict, List, Any, Optional, Tuple

EARTH_RADIUS_METERS = 6371000.0
WALKING_SPEED_METERS_PER_MIN = 80.0  # 4.8 km/h
ROAD_DETOUR_FACTOR = 1.35  # Urban road network winding multiplier


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance between two GPS coordinates in meters."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_METERS * c


def road_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Estimated road driving distance in kilometers."""
    direct_m = haversine_distance_meters(lat1, lon1, lat2, lon2)
    return round((direct_m * ROAD_DETOUR_FACTOR) / 1000.0, 2)


def calculate_commute_times(
    society_lat: float,
    society_lon: float,
    hubs: Dict[str, Dict[str, Any]],
    nearest_metro_dist_m: Optional[float] = None
) -> Tuple[Dict[str, int], Dict[str, Dict[str, Any]]]:
    """
    Computes dynamic commute times from a society to all city employment hubs.
    Returns:
      simple_matrix: Dict[hub_slug, peak_minutes] (stored in DB office_commute JSONB)
      detailed_breakdown: Full metrics per hub
    """
    simple_matrix: Dict[str, int] = {}
    detailed: Dict[str, Dict[str, Any]] = {}

    for hub_key, hub_data in hubs.items():
        hub_lat = hub_data["lat"]
        hub_lon = hub_data["lng"]
        hub_name = hub_data.get("name", hub_key)

        dist_km = road_distance_km(society_lat, society_lon, hub_lat, hub_lon)

        # Empirical traffic speed model for Indian Tier 1 metros:
        # Distance < 4 km: 16 km/h peak
        # Distance 4 - 15 km: 20 km/h peak
        # Distance > 15 km: 24 km/h peak (arterial/expressway sections)
        if dist_km <= 4.0:
            peak_speed = 16.0
            offpeak_speed = 28.0
        elif dist_km <= 15.0:
            peak_speed = 20.0
            offpeak_speed = 34.0
        else:
            peak_speed = 24.0
            offpeak_speed = 40.0

        # Base driving times (minutes) + 4 min parking/intersection overhead
        drive_peak_mins = int(round((dist_km / peak_speed) * 60.0 + 4.0))
        drive_offpeak_mins = int(round((dist_km / offpeak_speed) * 60.0 + 2.0))

        # Transit commute model:
        # If society is near a metro (<1200m), metro provides predictable ~32 km/h travel
        if nearest_metro_dist_m is not None and nearest_metro_dist_m <= 1200:
            walk_to_metro = nearest_metro_dist_m / WALKING_SPEED_METERS_PER_MIN
            metro_ride_time = (dist_km / 32.0) * 60.0
            transit_mins = int(round(walk_to_metro + metro_ride_time + 8.0))  # 8m wait + last mile
        else:
            # Bus/feeder transit is slightly slower than driving
            transit_mins = int(round(drive_peak_mins * 1.25))

        simple_matrix[hub_key] = drive_peak_mins
        detailed[hub_key] = {
            "name": hub_name,
            "road_km": dist_km,
            "peak_mins": drive_peak_mins,
            "offpeak_mins": drive_offpeak_mins,
            "transit_mins": transit_mins,
        }

    return simple_matrix, detailed


def find_nearest_station(
    society_lat: float,
    society_lon: float,
    stations: List[Dict[str, Any]],
    station_type: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Finds closest transit station to society.
    Returns: Dict with station name, type, distance_meters, walking_minutes, line.
    """
    if not stations:
        return None

    best_station = None
    min_dist = float("inf")

    for st in stations:
        if station_type and st.get("stop_type") != station_type:
            continue

        st_lat = st.get("lat")
        st_lon = st.get("lng")
        if st_lat is None or st_lon is None:
            continue

        dist_m = haversine_distance_meters(society_lat, society_lon, st_lat, st_lon)
        if dist_m < min_dist:
            min_dist = dist_m
            best_station = st

    if not best_station:
        return None

    walk_mins = int(round(min_dist / WALKING_SPEED_METERS_PER_MIN))
    return {
        "id": best_station.get("id"),
        "name": best_station.get("name"),
        "stop_type": best_station.get("stop_type"),
        "route_info": best_station.get("route_info", ""),
        "distance_meters": int(round(min_dist)),
        "walk_minutes": walk_mins,
        "lat": best_station.get("lat"),
        "lng": best_station.get("lng"),
    }
