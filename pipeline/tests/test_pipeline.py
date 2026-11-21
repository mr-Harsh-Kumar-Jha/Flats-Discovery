"""
Unit & Integration Tests for Pune-Flats Pipeline.
Run with: python3 -m unittest pipeline/tests/test_pipeline.py
"""

import unittest
import sys
from pathlib import Path

# Add pipeline directory to sys.path
pipeline_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(pipeline_dir))

from commute_engine import (
    haversine_distance_meters,
    road_distance_km,
    calculate_commute_times,
    find_nearest_station,
)
from society_finder import (
    slugify,
    clean_society_name,
    process_and_enrich_societies,
)
from osm_transit import parse_transit_stops


class TestPipeline(unittest.TestCase):

    def test_haversine_distance(self):
        # Pune Station (18.5284, 73.8742) to Shivajinagar (18.5310, 73.8480) ~ 2.78 km
        dist = haversine_distance_meters(18.5284, 73.8742, 18.5310, 73.8480)
        self.assertGreater(dist, 2500)
        self.assertLess(dist, 3100)

    def test_road_distance_multiplier(self):
        # Road distance should include winding factor ~ 1.35x
        direct_m = haversine_distance_meters(18.5284, 73.8742, 18.5310, 73.8480)
        road_km = road_distance_km(18.5284, 73.8742, 18.5310, 73.8480)
        self.assertAlmostEqual(road_km, round((direct_m * 1.35) / 1000.0, 2), places=1)

    def test_clean_society_name(self):
        self.assertEqual(clean_society_name("Amanora Park Town Co-operative Housing Society Ltd."), "Amanora Park Town")
        self.assertEqual(clean_society_name("Blue Ridge CHS"), "Blue Ridge")
        self.assertEqual(clean_society_name("Megapolis Mystic"), "Megapolis Mystic")

    def test_slugify(self):
        self.assertEqual(slugify("Amanora Park Town-pune"), "amanora-park-town-pune")
        self.assertEqual(slugify("Godrej Infinity (Keshavnagar)"), "godrej-infinity-keshavnagar")

    def test_find_nearest_station(self):
        stations = [
            {"id": 1, "name": "Station A", "stop_type": "metro_station", "lat": 18.5000, "lng": 73.8000, "route_info": "Aqua Line"},
            {"id": 2, "name": "Station B", "stop_type": "metro_station", "lat": 18.5500, "lng": 73.8500, "route_info": "Purple Line"},
        ]
        # Query near Station A
        nearest = find_nearest_station(18.5010, 73.8010, stations, "metro_station")
        self.assertIsNotNone(nearest)
        self.assertEqual(nearest["name"], "Station A")
        self.assertLess(nearest["distance_meters"], 300)

    def test_commute_calculation(self):
        hubs = {
            "hinjewadi": {"name": "Hinjewadi", "lat": 18.5913, "lng": 73.7389},
            "magarpatta": {"name": "Magarpatta", "lat": 18.5158, "lng": 73.9272},
        }
        # Point near Hinjewadi
        simple, detailed = calculate_commute_times(18.5900, 73.7400, hubs, nearest_metro_dist_m=400)
        self.assertIn("hinjewadi", simple)
        self.assertIn("magarpatta", simple)
        # Hinjewadi commute should be under 15 mins for adjacent location
        self.assertLess(simple["hinjewadi"], 15)
        # Magarpatta is across the city (~22km), peak commute should be > 40 mins
        self.assertGreater(simple["magarpatta"], 35)

    def test_society_enrichment_yield(self):
        raw_elements = [
            {
                "type": "way",
                "id": 999,
                "center": {"lat": 18.5200, "lon": 73.8500},
                "tags": {"name": "Test Residency", "landuse": "residential"}
            }
        ]
        transit_stops = [
            {"name": "PMC Metro", "stop_type": "metro_station", "lat": 18.5227, "lng": 73.8533, "route_info": "Aqua Line"}
        ]
        societies = process_and_enrich_societies(raw_elements, "pune", transit_stops)
        self.assertEqual(len(societies), 1)
        soc = societies[0]
        self.assertEqual(soc["name"], "Test Residency")
        # Rental yield should be realistic (between 2.5% and 5.0%)
        self.assertGreaterEqual(soc["rental_yield_pct"], 2.5)
        self.assertLessEqual(soc["rental_yield_pct"], 5.0)
        self.assertEqual(soc["nearest_metro_station"], "PMC Metro")
        self.assertIn("hinjewadi", soc["office_commute"])

    def test_monorail_and_rapid_rail_parsing(self):
        elements = [
            {
                "type": "node",
                "id": 901,
                "lat": 18.9818,
                "lon": 72.8290,
                "tags": {"name": "Jacob Circle Monorail", "station": "monorail", "network": "Mumbai Monorail"}
            },
            {
                "type": "node",
                "id": 902,
                "lat": 28.6470,
                "lon": 77.3150,
                "tags": {"name": "Anand Vihar RRTS", "highspeed": "yes", "network": "Namo Bharat RRTS"}
            },
            {
                "type": "node",
                "id": 903,
                "lat": 19.1205,
                "lon": 72.8465,
                "tags": {"name": "Andheri Metro", "station": "subway", "line": "Line 1"}
            }
        ]
        stops = parse_transit_stops(elements, "mumbai")
        self.assertEqual(len(stops), 3)
        types = {s["name"]: s["stop_type"] for s in stops}
        self.assertEqual(types["Jacob Circle Monorail"], "monorail_station")
        self.assertEqual(types["Anand Vihar RRTS"], "rapid_rail_station")
        self.assertEqual(types["Andheri Metro"], "metro_station")


if __name__ == "__main__":
    unittest.main()
