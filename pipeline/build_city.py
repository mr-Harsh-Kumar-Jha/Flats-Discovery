"""
Master City Discovery & Pipeline Builder for Pune-Flats.
Usage:
    python pipeline/build_city.py pune
    python pipeline/build_city.py mumbai
    python pipeline/build_city.py gurgaon
    python pipeline/build_city.py noida
    python pipeline/build_city.py all
Options:
    --force-refresh : Force re-querying live Overpass API
    --no-db         : Skip database sync (export GeoJSON only)
    --limit <N>     : Limit societies count per city
"""

import sys
import argparse
from typing import List

from config import CITIES
from osm_transit import (
    fetch_osm_transit_data,
    parse_transit_stops,
    export_transit_geojson,
)
from society_finder import (
    fetch_osm_societies,
    process_and_enrich_societies,
    export_societies_geojson,
)
from sync_db import (
    ensure_cities_exist,
    sync_transit_stops,
    sync_societies,
    sync_society_property_inventory,
)


def build_transit_routes_geojson(city_slug: str) -> dict:
    """
    Generates rich, styled route features for all commute mediums:
    - Metro lines
    - Suburban & mainline railways
    - Monorail (Mumbai)
    - Rapid Rail / RRTS (NCR / Noida)
    - Bus corridor feeder lines
    """
    features = []

    if city_slug == "pune":
        features.extend([
            {
                "type": "Feature",
                "properties": {
                    "id": "purple-line",
                    "name": "Pune Metro Purple Line (Line 1)",
                    "route_type": "metro",
                    "color": "#9333ea",
                    "details": "PCMC ⟷ Swargate (14 stations)",
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [73.8033, 18.6293], [73.8157, 18.6145], [73.8201, 18.6093],
                        [73.8273, 18.5996], [73.8311, 18.5911], [73.8338, 18.5838],
                        [73.8381, 18.5697], [73.8421, 18.5623], [73.8458, 18.5503],
                        [73.8497, 18.5322], [73.8569, 18.5268], [73.8596, 18.5214],
                        [73.8586, 18.5120], [73.8575, 18.4997]
                    ],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "id": "aqua-line",
                    "name": "Pune Metro Aqua Line (Line 2)",
                    "route_type": "metro",
                    "color": "#06b6d4",
                    "details": "Vanaz ⟷ Ramwadi (16 stations)",
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [73.8052, 18.5072], [73.8141, 18.5096], [73.8221, 18.5089],
                        [73.8288, 18.5074], [73.8381, 18.5120], [73.8444, 18.5164],
                        [73.8474, 18.5201], [73.8533, 18.5227], [73.8569, 18.5268],
                        [73.8645, 18.5272], [73.8744, 18.5289], [73.8777, 18.5327],
                        [73.8834, 18.5406], [73.8867, 18.5453], [73.9086, 18.5570]
                    ],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "id": "line-3",
                    "name": "Pune Metro Line 3 (Hinjewadi - Shivajinagar)",
                    "route_type": "metro",
                    "color": "#ec4899",
                    "details": "Megapolis Circle ⟷ District Court (23 stations)",
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [73.7389, 18.5913], [73.7480, 18.5950], [73.7620, 18.5920],
                        [73.7680, 18.5800], [73.7780, 18.5670], [73.7920, 18.5580],
                        [73.8296, 18.5314], [73.8569, 18.5268]
                    ],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "id": "pune-suburban-rail",
                    "name": "Pune - Lonavala Suburban Local Rail",
                    "route_type": "railway",
                    "color": "#dc2626",
                    "details": "Pune Junction ⟷ Shivajinagar ⟷ Khadki ⟷ Pimpri ⟷ Dehu Rd ⟷ Lonavala",
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [73.8744, 18.5289], [73.8520, 18.5310], [73.8340, 18.5620],
                        [73.8180, 18.5980], [73.7950, 18.6250], [73.7450, 18.6650]
                    ],
                },
            },
        ])
    elif city_slug == "mumbai":
        features.extend([
            {
                "type": "Feature",
                "properties": {
                    "id": "mumbai-monorail",
                    "name": "Mumbai Monorail (Green / Cyan Corridor)",
                    "route_type": "monorail",
                    "color": "#14b8a6",
                    "details": "Sant Gadge Maharaj Chowk (Jacob Circle) ⟷ Wadala ⟷ Chembur (17 stations)",
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [72.8290, 18.9818], [72.8335, 18.9950], [72.8480, 19.0110],
                        [72.8610, 19.0220], [72.8670, 19.0340], [72.8850, 19.0490],
                        [72.8990, 19.0620]
                    ],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "id": "mumbai-line-1",
                    "name": "Mumbai Metro Line 1 (Versova - Ghatkopar)",
                    "route_type": "metro",
                    "color": "#3b82f6",
                    "details": "Versova ⟷ D.N. Nagar ⟷ Andheri ⟷ Saki Naka ⟷ Ghatkopar",
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [72.8205, 19.1306], [72.8315, 19.1255], [72.8465, 19.1205],
                        [72.8570, 19.1155], [72.8680, 19.1120], [72.8750, 19.1100],
                        [72.8850, 19.1110], [72.8980, 19.1080], [72.9080, 19.0860]
                    ],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "id": "mumbai-line-3",
                    "name": "Mumbai Metro Line 3 (Aqua Underground)",
                    "route_type": "metro",
                    "color": "#06b6d4",
                    "details": "Aarey JVLR ⟷ SEEPZ ⟷ CSMIA Airport ⟷ BKC",
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [72.8880, 19.1430], [72.8820, 19.1350], [72.8720, 19.1280],
                        [72.8740, 19.0960], [72.8650, 19.0890], [72.8520, 19.0880],
                        [72.8687, 19.0657]
                    ],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "id": "mumbai-western-rail",
                    "name": "Western Railway Suburban Corridor",
                    "route_type": "railway",
                    "color": "#ef4444",
                    "details": "Churchgate ⟷ Mumbai Central ⟷ Dadar ⟷ Bandra ⟷ Andheri ⟷ Borivali",
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [72.8270, 18.9320], [72.8190, 18.9690], [72.8430, 19.0180],
                        [72.8400, 19.0550], [72.8460, 19.1190], [72.8570, 19.2290]
                    ],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "id": "mumbai-central-rail",
                    "name": "Central Railway Suburban Corridor",
                    "route_type": "railway",
                    "color": "#b91c1c",
                    "details": "CSMT ⟷ Byculla ⟷ Dadar ⟷ Kurla ⟷ Ghatkopar ⟷ Thane ⟷ Kalyan",
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [72.8350, 18.9400], [72.8330, 18.9750], [72.8430, 19.0180],
                        [72.8750, 19.0650], [72.9080, 19.0860], [72.9780, 19.1860]
                    ],
                },
            },
        ])
    elif city_slug == "gurgaon":
        features.extend([
            {
                "type": "Feature",
                "properties": {
                    "id": "rapid-metro",
                    "name": "Rapid Metro Gurugram",
                    "route_type": "metro",
                    "color": "#3b82f6",
                    "details": "Cyber City ⟷ Sikanderpur ⟷ Sector 55-56",
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [77.0895, 28.4950], [77.0930, 28.4910], [77.0940, 28.4830],
                        [77.0865, 28.4795], [77.0980, 28.4680], [77.1020, 28.4540],
                        [77.1040, 28.4410], [77.1110, 28.4280]
                    ],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "id": "yellow-line-gurgaon",
                    "name": "Delhi Metro Yellow Line (Gurugram Corridor)",
                    "route_type": "metro",
                    "color": "#eab308",
                    "details": "Guru Dronacharya ⟷ Sikanderpur ⟷ MG Road ⟷ Millennium City Centre",
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [77.1010, 28.4910], [77.0865, 28.4795], [77.0780, 28.4790],
                        [77.0720, 28.4720], [77.0715, 28.4595]
                    ],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "id": "gurgaon-rail",
                    "name": "Northern Railway Corridor (Gurgaon - Rewari)",
                    "route_type": "railway",
                    "color": "#dc2626",
                    "details": "Delhi Cantt ⟷ Gurgaon Railway Station ⟷ Garhi Harsaru",
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [77.0850, 28.5300], [77.0250, 28.4720], [76.9650, 28.4420]
                    ],
                },
            },
        ])
    elif city_slug == "noida":
        features.extend([
            {
                "type": "Feature",
                "properties": {
                    "id": "delhi-meerut-rrts",
                    "name": "Namo Bharat Rapid Rail (RRTS High-Speed Corridor)",
                    "route_type": "rapid_rail",
                    "color": "#f97316",
                    "details": "Anand Vihar ⟷ Sahibabad ⟷ Ghaziabad ⟷ Meerut (160 km/h Rapid Transit)",
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [77.3150, 28.6470], [77.3580, 28.6720], [77.4320, 28.6690],
                        [77.4850, 28.7120]
                    ],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "id": "noida-blue-line",
                    "name": "Delhi Metro Blue Line (Noida Corridor)",
                    "route_type": "metro",
                    "color": "#3b82f6",
                    "details": "Sector 15 ⟷ Botanical Garden ⟷ Sector 62 ⟷ Electronic City",
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [77.3110, 28.5830], [77.3180, 28.5780], [77.3261, 28.5708],
                        [77.3340, 28.5640], [77.3560, 28.5740], [77.3680, 28.5910],
                        [77.3710, 28.6180], [77.3725, 28.6271]
                    ],
                },
            },
            {
                "type": "Feature",
                "properties": {
                    "id": "nmrc-aqua-line",
                    "name": "NMRC Aqua Line (Noida - Greater Noida)",
                    "route_type": "metro",
                    "color": "#06b6d4",
                    "details": "Sector 51 ⟷ Sector 137 ⟷ Sector 142 ⟷ Pari Chowk",
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [77.3720, 28.5900], [77.3740, 28.5750], [77.3820, 28.5650],
                        [77.3758, 28.5135], [77.4172, 28.4975], [77.5020, 28.4680]
                    ],
                },
            },
        ])

    return {"type": "FeatureCollection", "features": features}


def run_pipeline_for_city(city_slug: str, force_refresh: bool = False, no_db: bool = False, limit: int = 50):
    """Executes the full automated discovery and valuation pipeline for a single city."""
    city_cfg = CITIES.get(city_slug)
    if not city_cfg:
        print(f"Error: Unknown city '{city_slug}'. Valid options: {list(CITIES.keys())}")
        return

    print("\n" + "=" * 70)
    print(f"  RUNNING PIPELINE: {city_cfg['name'].upper()} ({city_cfg['state']})")
    print("=" * 70)

    # Step 1: Transit extraction (Metro, Railway, Monorail, Rapid Rail, Bus)
    print("\n[Step 1/4] Extracting Metro, Monorail, Rapid Rail & Transit stations...")
    transit_raw = fetch_osm_transit_data(city_slug, force_refresh=force_refresh)
    transit_elements = transit_raw.get("elements", [])
    stops = parse_transit_stops(transit_elements, city_slug)
    routes_fc = build_transit_routes_geojson(city_slug)
    export_transit_geojson(city_slug, stops, routes_fc)

    # Step 2: Society Discovery & Valuation Modeling
    print("\n[Step 2/4] Discovering residential societies & calculating rental yields...")
    societies_raw = fetch_osm_societies(city_slug, force_refresh=force_refresh)
    societies = process_and_enrich_societies(societies_raw, city_slug, stops, limit=limit)
    export_societies_geojson(city_slug, societies)

    # Step 3: Database Synchronization with strict Deduplication & Inventory
    if not no_db:
        print("\n[Step 3/4] Syncing city, transit stops, societies & dynamic inventory...")
        ensure_cities_exist()
        sync_transit_stops(stops, city_cfg["id"])
        sync_societies(societies, city_cfg["id"])
        sync_society_property_inventory(city_slug, city_cfg["id"], societies)
    else:
        print("\n[Step 3/4] Skipped DB sync (--no-db flag enabled).")

    # Step 4: Verification summary
    print("\n[Step 4/4] Pipeline Complete!")
    print(f"  City: {city_cfg['name']}")
    print(f"  Transit Stations: {len(stops)}")
    print(f"  Housing Societies: {len(societies)}")
    if societies:
        avg_yield = sum(s["rental_yield_pct"] for s in societies) / len(societies)
        print(f"  Average Rental Yield: {avg_yield:.2f}%")
        print(f"  Sample Society: {societies[0]['name']} (Yield: {societies[0]['rental_yield_pct']}%, Nearest Metro: {societies[0]['nearest_metro_station']} - {societies[0]['metro_distance_meters']}m)")


def main():
    parser = argparse.ArgumentParser(description="Pune-Flats Automated City Discovery Pipeline")
    parser.add_argument("city", nargs="?", default="pune", help="City to process: pune | mumbai | gurgaon | noida | all")
    parser.add_argument("--force-refresh", action="store_true", help="Force refresh from Overpass API")
    parser.add_argument("--no-db", action="store_true", help="Skip database sync")
    parser.add_argument("--limit", type=int, default=50, help="Max societies to process per city")
    args = parser.parse_args()

    target = args.city.lower()
    if target == "all":
        for c in ["pune", "mumbai", "gurgaon", "noida"]:
            run_pipeline_for_city(c, force_refresh=args.force_refresh, no_db=args.no_db, limit=args.limit)
    else:
        run_pipeline_for_city(target, force_refresh=args.force_refresh, no_db=args.no_db, limit=args.limit)


if __name__ == "__main__":
    main()
