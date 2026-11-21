-- ============================================================================
-- Migration 000015: Dynamic Commute Mediums, Deduplication & Inventory Sync
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Deduplicate housing_societies and enforce strict uniqueness
-- ---------------------------------------------------------------------------
DELETE FROM housing_societies a
USING housing_societies b
WHERE a.ctid < b.ctid
  AND a.city_id = b.city_id
  AND a.slug = b.slug;

ALTER TABLE housing_societies
    ADD CONSTRAINT uq_housing_societies_city_slug UNIQUE (city_id, slug);

ALTER TABLE housing_societies
    ADD COLUMN IF NOT EXISTS osm_id BIGINT,
    ADD COLUMN IF NOT EXISTS available_sales_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS available_rentals_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS uq_housing_societies_osm 
    ON housing_societies (osm_id) 
    WHERE osm_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Deduplicate transit_stops and enforce strict uniqueness
-- ---------------------------------------------------------------------------
DELETE FROM transit_stops a
USING transit_stops b
WHERE a.ctid < b.ctid
  AND a.city_id = b.city_id
  AND a.stop_type = b.stop_type
  AND a.name = b.name;

ALTER TABLE transit_stops
    DROP CONSTRAINT IF EXISTS uq_transit_stops_city_type_name;

ALTER TABLE transit_stops
    ADD CONSTRAINT uq_transit_stops_city_type_name UNIQUE (city_id, stop_type, name);

-- ---------------------------------------------------------------------------
-- 3. Enhance flat_pins with society linkage and external_id for idempotent sync
-- ---------------------------------------------------------------------------
ALTER TABLE flat_pins
    ADD COLUMN IF NOT EXISTS society_id UUID REFERENCES housing_societies(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS external_id VARCHAR(120),
    ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE flat_pins
    DROP CONSTRAINT IF EXISTS uq_flat_pins_external_id;

ALTER TABLE flat_pins
    ADD CONSTRAINT uq_flat_pins_external_id UNIQUE (external_id);

CREATE INDEX IF NOT EXISTS idx_flat_pins_society_id 
    ON flat_pins (society_id);

CREATE INDEX IF NOT EXISTS idx_flat_pins_for_sale 
    ON flat_pins (city_id, is_for_sale) 
    WHERE is_for_sale = true;
