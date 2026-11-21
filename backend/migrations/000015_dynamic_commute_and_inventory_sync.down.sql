DROP INDEX IF EXISTS idx_flat_pins_for_sale;
DROP INDEX IF EXISTS idx_flat_pins_society_id;
DROP INDEX IF EXISTS uq_flat_pins_external_id;

ALTER TABLE flat_pins
    DROP COLUMN IF EXISTS last_synced_at,
    DROP COLUMN IF EXISTS external_id,
    DROP COLUMN IF EXISTS society_id;

ALTER TABLE transit_stops
    DROP CONSTRAINT IF EXISTS uq_transit_stops_city_type_name;

DROP INDEX IF EXISTS uq_housing_societies_osm;

ALTER TABLE housing_societies
    DROP CONSTRAINT IF EXISTS uq_housing_societies_city_slug,
    DROP COLUMN IF EXISTS updated_at,
    DROP COLUMN IF EXISTS last_synced_at,
    DROP COLUMN IF EXISTS available_rentals_count,
    DROP COLUMN IF EXISTS available_sales_count,
    DROP COLUMN IF EXISTS osm_id;
