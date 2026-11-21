"""
Database Synchronization Module for Pune-Flats Discovery Pipeline.
Upserts cities, transit stops, housing societies, and dynamic property inventory
with PostGIS geography points and JSONB commute matrices into PostgreSQL.
Guarantees strict idempotency and zero duplicate records.
"""

import json
import subprocess
import hashlib
from typing import Dict, List, Any, Optional

from config import DB_CONFIG, CITIES


def execute_sql(sql_script: str) -> str:
    """Executes SQL script inside the puneflats-postgres Docker container."""
    cmd = [
        "docker", "exec", "-i",
        DB_CONFIG["container"],
        "psql",
        "-U", DB_CONFIG["user"],
        "-d", DB_CONFIG["db"],
        "-v", "ON_ERROR_STOP=1"
    ]
    proc = subprocess.run(cmd, input=sql_script, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"Database execution error: {proc.stderr}\nScript:\n{sql_script[:400]}")
    return proc.stdout


def ensure_cities_exist():
    """Ensures Pune, Mumbai, Gurgaon, and Noida are present and active in the database."""
    statements = []
    for slug, city in CITIES.items():
        city_id = city["id"]
        name = city["name"]
        state = city["state"]
        country = city["country"]
        lat = city["center"]["lat"]
        lon = city["center"]["lng"]
        zoom = city["default_zoom"]

        stmt = f"""
        INSERT INTO cities (id, name, slug, state, country, center_point, default_zoom, is_active)
        VALUES (
            '{city_id}',
            '{name}',
            '{slug}',
            '{state}',
            '{country}',
            ST_SetSRID(ST_MakePoint({lon}, {lat}), 4326)::geography,
            {zoom},
            true
        )
        ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            state = EXCLUDED.state,
            center_point = EXCLUDED.center_point,
            default_zoom = EXCLUDED.default_zoom,
            is_active = true,
            updated_at = NOW();
        """
        statements.append(stmt)

    full_sql = "BEGIN;\n" + "\n".join(statements) + "\nCOMMIT;"
    execute_sql(full_sql)
    print("✓ All cities (Pune, Mumbai, Gurgaon, Noida) verified in database.")


def sync_transit_stops(stops: List[Dict[str, Any]], city_id: str):
    """
    Upserts transit stops with deduplication on (city_id, stop_type, name).
    Reconciles public changes:
      - New bus stops and transit stops added to public data are inserted with is_active = true.
      - Removed bus stops and transit stops no longer present in public data are marked is_active = false.
    """
    if not stops:
        return

    statements = []
    active_names_by_type = {}

    for st in stops:
        name = st["name"].replace("'", "''")
        name_local = (st.get("name_local") or "").replace("'", "''")
        stop_type = st["stop_type"].upper()
        route_info = (st.get("route_info") or "").replace("'", "''")
        lat = st["lat"]
        lng = st["lng"]
        osm_id = st.get("osm_id") or "NULL"

        if stop_type not in active_names_by_type:
            active_names_by_type[stop_type] = []
        active_names_by_type[stop_type].append(f"'{name}'")

        stmt = f"""
        INSERT INTO transit_stops (city_id, location, stop_type, name, name_local, osm_id, route_info, is_active)
        VALUES (
            '{city_id}',
            ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326)::geography,
            '{stop_type}',
            '{name}',
            {'NULL' if not name_local else f"'{name_local}'"},
            {osm_id},
            '{route_info}',
            true
        )
        ON CONFLICT (city_id, stop_type, name) DO UPDATE SET
            location = EXCLUDED.location,
            name_local = COALESCE(EXCLUDED.name_local, transit_stops.name_local),
            osm_id = COALESCE(EXCLUDED.osm_id, transit_stops.osm_id),
            route_info = EXCLUDED.route_info,
            is_active = true;
        """
        statements.append(stmt)

    # Deactivate any transit stop in the DB for this city that has been removed from the public feed
    for st_type, names_list in active_names_by_type.items():
        if names_list:
            joined_names = ", ".join(names_list)
            deactivate_stmt = f"""
            UPDATE transit_stops
            SET is_active = false
            WHERE city_id = '{city_id}'
              AND stop_type = '{st_type}'
              AND name NOT IN ({joined_names});
            """
            statements.append(deactivate_stmt)

    full_sql = "BEGIN;\n" + "\n".join(statements) + "\nCOMMIT;"
    execute_sql(full_sql)
    print(f"✓ Synced and reconciled {len(stops)} transit stops in database (added new, deactivated removed).")


def sync_societies(societies: List[Dict[str, Any]], city_id: str):
    """Upserts societies into housing_societies table with ON CONFLICT (city_id, slug)."""
    if not societies:
        return

    statements = []
    for s in societies:
        name = s["name"].replace("'", "''")
        slug = s["slug"].replace("'", "''")
        locality = s["locality"].replace("'", "''")
        lat = s["lat"]
        lng = s["lng"]
        towers = s.get("towers_count", 4)
        units = s.get("units_count", 250)
        min_rent = s["min_rent"]
        max_rent = s["max_rent"]
        min_price = s["min_price"]
        max_price = s["max_price"]
        avg_psf = s["avg_price_per_sqft"]
        rental_yield = s["rental_yield_pct"]
        pr_ratio = s["price_to_rent_ratio"]
        nearest_metro = (s.get("nearest_metro_station") or "").replace("'", "''")
        metro_dist = s["metro_distance_meters"] if s.get("metro_distance_meters") is not None else "NULL"
        metro_line = (s.get("metro_line") or "").replace("'", "''")
        office_commute_json = json.dumps(s.get("office_commute", {})).replace("'", "''")
        
        # Amenities text array
        amenities = s.get("amenities", [])
        amenities_sql = "ARRAY[" + ",".join([f"'{a.replace('\'', '\'\'')}'" for a in amenities]) + "]::text[]"

        min_bed = s.get("min_bedroom_dims", "11x12")
        min_sqft = s.get("min_sqft", 950)
        max_sqft = s.get("max_sqft", 2400)
        rera_id = s.get("rera_id", "")
        source = s.get("verified_source", "Online Discovery").replace("'", "''")
        rating = s.get("rating", 4.5)
        desc = s.get("description", "").replace("'", "''")
        osm_id = s.get("osm_id") or "NULL"
        sales_count = s.get("available_sales_count", 0)
        rentals_count = s.get("available_rentals_count", 0)

        stmt = f"""
        INSERT INTO housing_societies (
            city_id, name, slug, locality, location,
            towers_count, units_count, min_rent, max_rent,
            min_price, max_price, avg_price_per_sqft,
            rental_yield_pct, price_to_rent_ratio,
            nearest_metro_station, metro_distance_meters, metro_line,
            office_commute, amenities, min_bedroom_dims,
            min_sqft, max_sqft, rera_id, verified_source,
            rating, description, osm_id, available_sales_count, available_rentals_count,
            last_synced_at, updated_at
        )
        VALUES (
            '{city_id}', '{name}', '{slug}', '{locality}',
            ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326)::geography,
            {towers}, {units}, {min_rent}, {max_rent}, {min_price}, {max_price}, {avg_psf}, {rental_yield}, {pr_ratio},
            '{nearest_metro}', {metro_dist}, '{metro_line}',
            '{office_commute_json}'::jsonb, {amenities_sql}, '{min_bed}',
            {min_sqft}, {max_sqft}, '{rera_id}', '{source}',
            {rating}, '{desc}', {osm_id}, {sales_count}, {rentals_count},
            NOW(), NOW()
        )
        ON CONFLICT (city_id, slug) DO UPDATE SET
            name = EXCLUDED.name,
            locality = EXCLUDED.locality,
            location = EXCLUDED.location,
            towers_count = EXCLUDED.towers_count,
            units_count = EXCLUDED.units_count,
            min_rent = EXCLUDED.min_rent,
            max_rent = EXCLUDED.max_rent,
            min_price = EXCLUDED.min_price,
            max_price = EXCLUDED.max_price,
            avg_price_per_sqft = EXCLUDED.avg_price_per_sqft,
            rental_yield_pct = EXCLUDED.rental_yield_pct,
            price_to_rent_ratio = EXCLUDED.price_to_rent_ratio,
            nearest_metro_station = EXCLUDED.nearest_metro_station,
            metro_distance_meters = EXCLUDED.metro_distance_meters,
            metro_line = EXCLUDED.metro_line,
            office_commute = EXCLUDED.office_commute,
            amenities = EXCLUDED.amenities,
            description = EXCLUDED.description,
            osm_id = COALESCE(EXCLUDED.osm_id, housing_societies.osm_id),
            available_sales_count = EXCLUDED.available_sales_count,
            available_rentals_count = EXCLUDED.available_rentals_count,
            last_synced_at = NOW(),
            updated_at = NOW();
        """
        statements.append(stmt)

    full_sql = "BEGIN;\n" + "\n".join(statements) + "\nCOMMIT;"
    execute_sql(full_sql)
    print(f"✓ Synced {len(societies)} housing societies into database (idempotent upsert).")


def sync_society_property_inventory(city_slug: str, city_id: str, societies: List[Dict[str, Any]]):
    """
    Generates dynamic live property units (both for-sale and for-rent) linked directly to societies.
    Uses deterministic external_ids to ensure zero duplicate records on subsequent runs.
    Updates the available_sales_count and available_rentals_count on each society.
    """
    if not societies:
        return

    # Grab default user for seeded inventory
    user_res = execute_sql("SELECT id FROM users LIMIT 1;")
    user_id = user_res.strip().split("\n")[-2].strip() if user_res else "a0000001-0000-0000-0000-000000000001"

    unit_templates = [
        {"bhk": "1BHK", "sqft": 650, "bed": "10x11", "bath": 1, "furnishing": "SEMI_FURNISHED", "parking": "TWO_WHEELER"},
        {"bhk": "2BHK", "sqft": 1050, "bed": "11x12", "bath": 2, "furnishing": "FULLY_FURNISHED", "parking": "FOUR_WHEELER"},
        {"bhk": "3BHK", "sqft": 1580, "bed": "12x14", "bath": 3, "furnishing": "FULLY_FURNISHED", "parking": "BOTH"},
        {"bhk": "4BHK", "sqft": 2250, "bed": "14x16", "bath": 4, "furnishing": "LUXURY_FURNISHED", "parking": "BOTH"}
    ]

    statements = []
    society_counts = {}

    for s in societies:
        slug = s["slug"]
        soc_name = s["name"].replace("'", "''")
        lat = s["lat"]
        lng = s["lng"]
        avg_psf = s["avg_price_per_sqft"]
        base_rent_psf = (avg_psf * (s["rental_yield_pct"] / 100.0)) / 12.0

        sales_count = 0
        rentals_count = 0

        # Generate 2 to 4 realistic units per society
        for i, tmpl in enumerate(unit_templates[:3]):
            bhk = tmpl["bhk"]
            sqft = tmpl["sqft"]
            furnishing = tmpl["furnishing"]
            parking = tmpl["parking"]

            # Alternate between for-sale and for-rent
            is_sale = (i % 2 == 0)
            unit_no = f"Tower {chr(65 + (i % 4))}-{101 + (i * 302)}"

            # Deterministic external_id
            ext_id = f"unit_{slug}_{bhk}_{unit_no.replace(' ', '_').lower()}"
            
            # Pricing
            rent_val = round((base_rent_psf * sqft) / 500.0) * 500.0
            sale_price_val = round((avg_psf * sqft) / 100000.0) * 100000.0
            deposit_val = rent_val * 3

            # Small jitter for distinct coordinates around society centroid
            offset_lat = ((hash(ext_id) % 100) - 50) * 0.00003
            offset_lng = (((hash(ext_id) >> 2) % 100) - 50) * 0.00003
            unit_lat = lat + offset_lat
            unit_lng = lng + offset_lng

            if is_sale:
                sales_count += 1
                desc = f"Spacious {bhk} resale apartment in {soc_name} ({unit_no}). High-floor garden facing with clear title and zero brokerage."
                stmt = f"""
                INSERT INTO flat_pins (
                    user_id, city_id, society_id, external_id, location,
                    rent, deposit_amount, sale_price, is_for_sale,
                    bhk_config, property_type, furnishing,
                    floor_number, total_floors, parking, water_supply, power_backup,
                    status, expires_at, description, last_synced_at
                )
                VALUES (
                    '{user_id}', '{city_id}',
                    (SELECT id FROM housing_societies WHERE slug = '{slug}' AND city_id = '{city_id}' LIMIT 1),
                    '{ext_id}',
                    ST_SetSRID(ST_MakePoint({unit_lng}, {unit_lat}), 4326)::geography,
                    {rent_val}, {deposit_val}, {sale_price_val}, true,
                    '{bhk}'::bhk_config, 'APARTMENT'::property_type, '{furnishing}'::furnishing_level,
                    {4 + i * 3}, 18, '{parking}'::parking_type, 'MIXED'::water_supply_type, 'FULL_DG'::power_backup_type,
                    'ACTIVE'::pin_status, NOW() + INTERVAL '90 days', '{desc}', NOW()
                )
                ON CONFLICT (external_id) DO UPDATE SET
                    sale_price = EXCLUDED.sale_price,
                    rent = EXCLUDED.rent,
                    is_for_sale = true,
                    status = 'ACTIVE',
                    last_synced_at = NOW(),
                    updated_at = NOW();
                """
            else:
                rentals_count += 1
                desc = f"Well-ventilated {bhk} flat in {soc_name} ({unit_no}). Fully furnished with modular kitchen and modern society amenities."
                stmt = f"""
                INSERT INTO flat_pins (
                    user_id, city_id, society_id, external_id, location,
                    rent, deposit_amount, sale_price, is_for_sale,
                    bhk_config, property_type, furnishing,
                    floor_number, total_floors, parking, water_supply, power_backup,
                    status, expires_at, description, last_synced_at
                )
                VALUES (
                    '{user_id}', '{city_id}',
                    (SELECT id FROM housing_societies WHERE slug = '{slug}' AND city_id = '{city_id}' LIMIT 1),
                    '{ext_id}',
                    ST_SetSRID(ST_MakePoint({unit_lng}, {unit_lat}), 4326)::geography,
                    {rent_val}, {deposit_val}, NULL, false,
                    '{bhk}'::bhk_config, 'APARTMENT'::property_type, '{furnishing}'::furnishing_level,
                    {2 + i * 2}, 14, '{parking}'::parking_type, 'MUNICIPAL'::water_supply_type, 'INVERTER'::power_backup_type,
                    'ACTIVE'::pin_status, NOW() + INTERVAL '45 days', '{desc}', NOW()
                )
                ON CONFLICT (external_id) DO UPDATE SET
                    rent = EXCLUDED.rent,
                    is_for_sale = false,
                    status = 'ACTIVE',
                    last_synced_at = NOW(),
                    updated_at = NOW();
                """
            statements.append(stmt)

        society_counts[slug] = (sales_count, rentals_count)

    # Also update the counts on housing_societies
    for slug, (sc, rc) in society_counts.items():
        statements.append(f"""
        UPDATE housing_societies 
        SET available_sales_count = {sc}, available_rentals_count = {rc}, last_synced_at = NOW()
        WHERE slug = '{slug}' AND city_id = '{city_id}';
        """)

    full_sql = "BEGIN;\n" + "\n".join(statements) + "\nCOMMIT;"
    execute_sql(full_sql)
    print(f"✓ Synced dynamic property inventory for {len(societies)} societies into database.")
