"""
OSM Transit Data Extractor for Pune-Flats Pipeline.
Dynamically extracts, parses and styles:
  - Metro lines and light rail networks (Pune Metro, Mumbai Metro, Rapid Metro, Aqua Line)
  - Railway tracks and local suburban commuter corridors (Western, Central, Harbour, Northern)
  - Monorail network (Mumbai Monorail)
  - Rapid Rail (Namo Bharat RRTS Delhi-Meerut high-speed corridor)
  - Bus rapid transit (BRT) and primary transit interchanges
from OpenStreetMap (Overpass API) with automatic mirror rotation, deduplication, and resilient offline caching.
"""

import json
import urllib.request
import urllib.parse
import ssl
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

from config import OVERPASS_ENDPOINTS, CACHE_DIR, OUT_DIR, FRONTEND_DATA_DIR, CITIES, BASE_DIR


def build_transit_overpass_query(bbox: List[float]) -> str:
    """
    Constructs an Overpass QL query for all commute infrastructure inside a bounding box:
    metro, railway, monorail, rapid rail, and bus interchanges.
    bbox: [min_lat, min_lon, max_lat, max_lon]
    """
    s, w, n, e = bbox[0], bbox[1], bbox[2], bbox[3]
    return f"""
[out:json][timeout:30];
(
  // 1. Metro, Monorail & Railway Stations
  node["station"="subway"]({s},{w},{n},{e});
  node["station"="monorail"]({s},{w},{n},{e});
  node["railway"="station"]({s},{w},{n},{e});
  node["railway"="halt"]({s},{w},{n},{e});
  node["railway"="monorail"]({s},{w},{n},{e});
  node["subway"="yes"]({s},{w},{n},{e});

  // 2. High Speed / Rapid Rail Stations
  node["highspeed"="yes"]({s},{w},{n},{e});
  node["railway"="station"]["service"="high_speed"]({s},{w},{n},{e});

  // 3. Major Bus Terminals & Interchanges
  node["amenity"="bus_station"]({s},{w},{n},{e});
  node["highway"="bus_stop"]["name"]({s},{w},{n},{e});

  // 4. Transit Way Tracks (Metro, Monorail, Light Rail, Mainline Rail)
  way["railway"="subway"]({s},{w},{n},{e});
  way["railway"="light_rail"]({s},{w},{n},{e});
  way["railway"="monorail"]({s},{w},{n},{e});
  way["railway"="rail"]({s},{w},{n},{e});
  way["railway"="narrow_gauge"]({s},{w},{n},{e});
  
  // 5. Transit route relations
  relation["route"="subway"]({s},{w},{n},{e});
  relation["route"="light_rail"]({s},{w},{n},{e});
  relation["route"="monorail"]({s},{w},{n},{e});
  relation["route"="train"]({s},{w},{n},{e});
);
out body;
>;
out skel qt;
"""


def fetch_osm_transit_data(city_slug: str, force_refresh: bool = False) -> Dict[str, Any]:
    """
    Fetches transit data from Overpass API with mirror rotation, SSL fallback,
    and local cache persistence.
    """
    cache_file = CACHE_DIR / f"{city_slug}_transit_raw.json"

    if cache_file.exists() and not force_refresh:
        print(f"[{city_slug}] Loading transit data from cache: {cache_file}")
        with open(cache_file, "r", encoding="utf-8") as f:
            return json.load(f)

    city_cfg = CITIES.get(city_slug)
    if not city_cfg:
        raise ValueError(f"Unknown city: {city_slug}")

    query = build_transit_overpass_query(city_cfg["bbox"])
    post_data = urllib.parse.urlencode({"data": query}).encode("utf-8")
    ssl_context = ssl._create_unverified_context()

    last_error = None
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            print(f"[{city_slug}] Querying Overpass endpoint for transit: {endpoint}...")
            req = urllib.request.Request(
                endpoint,
                data=post_data,
                headers={"User-Agent": "PuneFlatsPipeline/2.0"}
            )
            with urllib.request.urlopen(req, timeout=4.0, context=ssl_context) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    elements = data.get("elements", [])
                    if elements:
                        print(f"[{city_slug}] Successfully fetched {len(elements)} elements from {endpoint}")
                        with open(cache_file, "w", encoding="utf-8") as f:
                            json.dump(data, f, indent=2)
                        return data
        except Exception as e:
            print(f"[{city_slug}] Mirror {endpoint} failed: {e}")
            last_error = e

    # Resilient fallback to verified city seeds
    seed_file = BASE_DIR / "seeds" / f"{city_slug}_transit_seed.json"
    if seed_file.exists():
        print(f"[{city_slug}] Overpass unreachable ({last_error}). Using verified seed: {seed_file}")
        with open(seed_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            with open(cache_file, "w", encoding="utf-8") as cf:
                json.dump(data, cf, indent=2)
            return data

    raise RuntimeError(f"Failed to fetch transit data for {city_slug}: {last_error}")


def parse_transit_stops(elements: List[Dict[str, Any]], city_slug: str) -> List[Dict[str, Any]]:
    """
    Parses OSM nodes into standardized transit stop objects:
    Categorizes:
      - metro_station (Subway, Metro, Rapid Metro)
      - monorail_station (Monorail)
      - rapid_rail_station (RRTS, High Speed)
      - railway_station (Suburban Rail, Mainline)
      - bus_station (Bus Terminal, Intercity Depot)
    Guarantees spatial and name deduplication.
    """
    stops = []
    seen_keys = set()

    for el in elements:
        if el.get("type") != "node":
            continue

        tags = el.get("tags", {})
        name = tags.get("name", "").strip()
        if not name:
            continue

        lat = el.get("lat")
        lon = el.get("lon")
        if lat is None or lon is None:
            continue

        name_lower = name.lower()

        # Classify Stop Medium
        is_monorail = (
            tags.get("station") == "monorail" or
            tags.get("railway") == "monorail" or
            "monorail" in name_lower or
            tags.get("network") == "Mumbai Monorail"
        )
        is_rapid_rail = (
            tags.get("highspeed") == "yes" or
            "rrts" in name_lower or
            "namo bharat" in name_lower or
            "rapid rail" in name_lower
        )
        is_subway = (
            not is_monorail and not is_rapid_rail and (
                tags.get("station") == "subway" or
                tags.get("subway") == "yes" or
                tags.get("railway") == "subway_entrance" or
                "metro" in name_lower or
                "metro station" in tags.get("description", "").lower()
            )
        )
        is_rail = (
            not is_monorail and not is_rapid_rail and not is_subway and
            tags.get("railway") in ["station", "halt"]
        )
        is_bus = (
            not is_monorail and not is_rapid_rail and not is_subway and not is_rail and
            (tags.get("amenity") == "bus_station" or tags.get("highway") == "bus_stop")
        )

        if not (is_monorail or is_rapid_rail or is_subway or is_rail or is_bus):
            continue

        if is_monorail:
            stop_type = "monorail_station"
            route_info = tags.get("network") or "Mumbai Monorail Corridor"
        elif is_rapid_rail:
            stop_type = "rapid_rail_station"
            route_info = tags.get("network") or "Namo Bharat RRTS High-Speed Corridor"
        elif is_subway:
            stop_type = "metro_station"
            route_info = tags.get("line") or tags.get("network") or "Metro Line"
        elif is_rail:
            stop_type = "railway_station"
            route_info = tags.get("network") or "Suburban / Mainline Railway"
        else:
            stop_type = "bus_station"
            route_info = tags.get("operator") or "City Bus Corridor"

        # Spatial + Name Deduplication (round coordinates to ~100m)
        lat_grid = round(lat, 3)
        lon_grid = round(lon, 3)
        dedup_key = f"{name_lower}_{stop_type}_{lat_grid}_{lon_grid}"
        if dedup_key in seen_keys:
            continue
        seen_keys.add(dedup_key)

        stops.append({
            "name": name,
            "name_local": tags.get("name:mr") or tags.get("name:hi") or tags.get("name:local"),
            "stop_type": stop_type,
            "route_info": route_info,
            "lat": lat,
            "lng": lon,
            "osm_id": el.get("id"),
        })

    return stops


def stops_to_geojson(stops: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Converts a list of stop dictionaries into a GeoJSON FeatureCollection."""
    features = []
    for st in stops:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [st["lng"], st["lat"]],
            },
            "properties": {
                "name": st["name"],
                "name_local": st.get("name_local"),
                "stop_type": st["stop_type"],
                "route_info": st["route_info"],
                "osm_id": st.get("osm_id"),
            },
        })
    return {"type": "FeatureCollection", "features": features}


def export_transit_geojson(city_slug: str, stops: List[Dict[str, Any]], routes: Dict[str, Any]):
    """Exports GeoJSON files to pipeline/out/ and frontend/public/data/."""
    stops_fc = stops_to_geojson(stops)

    out_stops = OUT_DIR / f"{city_slug}_transit_stops.geojson"
    out_routes = OUT_DIR / f"{city_slug}_transit_routes.geojson"

    with open(out_stops, "w", encoding="utf-8") as f:
        json.dump(stops_fc, f, indent=2)
    with open(out_routes, "w", encoding="utf-8") as f:
        json.dump(routes, f, indent=2)

    fe_stops = FRONTEND_DATA_DIR / f"{city_slug}_transit_stops.geojson"
    fe_routes = FRONTEND_DATA_DIR / f"{city_slug}_transit_routes.geojson"

    with open(fe_stops, "w", encoding="utf-8") as f:
        json.dump(stops_fc, f, indent=2)
    with open(fe_routes, "w", encoding="utf-8") as f:
        json.dump(routes, f, indent=2)

    print(f"[{city_slug}] Exported transit GeoJSON: {len(stops)} stops, {len(routes.get('features', []))} route lines.")
