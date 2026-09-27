-- ============================================================================
-- Migration 000008: Transit Stops (for Opportunity Value TransitScore)
-- ============================================================================
-- Transit stops are used by the matchmaking engine to calculate the
-- TransitScore component of the Opportunity Value algorithm.
--
-- Data source: OpenStreetMap (Overpass API) for Pune.
-- This migration creates the table and seeds initial data.
-- Future cities are added via INSERT, not schema changes.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Transit Stops Table
-- ---------------------------------------------------------------------------
CREATE TABLE transit_stops (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id             UUID                    NOT NULL REFERENCES cities(id),

    -- Geospatial
    location            GEOGRAPHY(Point, 4326)  NOT NULL,

    -- Classification
    stop_type           VARCHAR(20)             NOT NULL,   -- 'metro_station', 'bus_stop', 'railway_station'
    name                VARCHAR(200)            NOT NULL,
    name_local          VARCHAR(200),                       -- Local language name (Marathi/Hindi)

    -- Metadata
    osm_id              BIGINT,                             -- OpenStreetMap node ID for provenance
    route_info          TEXT,                                -- e.g., "Purple Line", "PMPML Route 101"
    is_active           BOOLEAN                 NOT NULL DEFAULT true,

    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

-- Spatial index: the matchmaking engine queries nearest transit stop to each flat
-- using ST_Distance + KNN ordering (ORDER BY location <-> flat_location)
CREATE INDEX idx_transit_stops_location ON transit_stops USING GIST (location);

-- City scoping
CREATE INDEX idx_transit_stops_city_type ON transit_stops (city_id, stop_type)
    WHERE is_active = true;

-- OSM deduplication
CREATE UNIQUE INDEX uq_transit_stops_osm ON transit_stops (osm_id)
    WHERE osm_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Seed: Pune City
-- ---------------------------------------------------------------------------
-- Insert Pune as the first (and only active) city.
-- center_point = Shivajinagar area (central Pune)
INSERT INTO cities (name, slug, state, country, center_point, default_zoom, is_active)
VALUES (
    'Pune',
    'pune',
    'Maharashtra',
    'IN',
    ST_MakePoint(73.8567, 18.5204)::geography,  -- lng, lat (Shivajinagar)
    12,
    true
);

-- Pre-register upcoming cities (inactive, for frontend city selector)
INSERT INTO cities (name, slug, state, country, center_point, default_zoom, is_active)
VALUES
    ('Gurgaon', 'gurgaon', 'Haryana', 'IN', ST_MakePoint(77.0266, 28.4595)::geography, 12, false),
    ('Noida',   'noida',   'Uttar Pradesh', 'IN', ST_MakePoint(77.3910, 28.5355)::geography, 12, false);

-- ---------------------------------------------------------------------------
-- 3. Seed: Pune Metro Stations (Purple & Aqua Lines)
-- ---------------------------------------------------------------------------
-- Source: Pune Metro Rail Corporation (Maha-Metro) official station list.
-- These are approximate coordinates from OpenStreetMap.
DO $$
DECLARE
    pune_id UUID;
BEGIN
    SELECT id INTO pune_id FROM cities WHERE slug = 'pune';

    -- Purple Line (East-West): PCMC to Swargate
    INSERT INTO transit_stops (city_id, location, stop_type, name, route_info) VALUES
        (pune_id, ST_MakePoint(73.8076, 18.6298)::geography, 'metro_station', 'PCMC',                'Purple Line'),
        (pune_id, ST_MakePoint(73.8075, 18.6218)::geography, 'metro_station', 'Sant Tukaram Nagar',  'Purple Line'),
        (pune_id, ST_MakePoint(73.8087, 18.6134)::geography, 'metro_station', 'Bhosari',             'Purple Line'),
        (pune_id, ST_MakePoint(73.8102, 18.6048)::geography, 'metro_station', 'Kasarwadi',           'Purple Line'),
        (pune_id, ST_MakePoint(73.8127, 18.5942)::geography, 'metro_station', 'Phugewadi',           'Purple Line'),
        (pune_id, ST_MakePoint(73.8168, 18.5825)::geography, 'metro_station', 'Dapodi',              'Purple Line'),
        (pune_id, ST_MakePoint(73.8282, 18.5665)::geography, 'metro_station', 'Bopodi',              'Purple Line'),
        (pune_id, ST_MakePoint(73.8361, 18.5568)::geography, 'metro_station', 'Khadki',              'Purple Line'),
        (pune_id, ST_MakePoint(73.8454, 18.5438)::geography, 'metro_station', 'Range Hills',         'Purple Line'),
        (pune_id, ST_MakePoint(73.8507, 18.5337)::geography, 'metro_station', 'Shivajinagar',        'Purple Line'),
        (pune_id, ST_MakePoint(73.8558, 18.5259)::geography, 'metro_station', 'Civil Court',         'Purple Line'),
        (pune_id, ST_MakePoint(73.8623, 18.5186)::geography, 'metro_station', 'Budhwar Peth',        'Purple Line'),
        (pune_id, ST_MakePoint(73.8651, 18.5125)::geography, 'metro_station', 'Mandai',              'Purple Line'),
        (pune_id, ST_MakePoint(73.8635, 18.5035)::geography, 'metro_station', 'Swargate',            'Purple Line');

    -- Aqua Line (North-South): Vanaz to Ramwadi
    INSERT INTO transit_stops (city_id, location, stop_type, name, route_info) VALUES
        (pune_id, ST_MakePoint(73.8072, 18.5126)::geography, 'metro_station', 'Vanaz',               'Aqua Line'),
        (pune_id, ST_MakePoint(73.8148, 18.5130)::geography, 'metro_station', 'Anand Nagar',         'Aqua Line'),
        (pune_id, ST_MakePoint(73.8224, 18.5148)::geography, 'metro_station', 'Ideal Colony',        'Aqua Line'),
        (pune_id, ST_MakePoint(73.8286, 18.5151)::geography, 'metro_station', 'Nal Stop',            'Aqua Line'),
        (pune_id, ST_MakePoint(73.8390, 18.5163)::geography, 'metro_station', 'Garware College',     'Aqua Line'),
        (pune_id, ST_MakePoint(73.8465, 18.5175)::geography, 'metro_station', 'Deccan Gymkhana',     'Aqua Line'),
        (pune_id, ST_MakePoint(73.8545, 18.5202)::geography, 'metro_station', 'Chhatrapati Sambhaji Udyan', 'Aqua Line'),
        (pune_id, ST_MakePoint(73.8623, 18.5186)::geography, 'metro_station', 'PMC (Civil Court)',   'Aqua Line'),
        (pune_id, ST_MakePoint(73.8710, 18.5195)::geography, 'metro_station', 'Mangalwar Peth',      'Aqua Line'),
        (pune_id, ST_MakePoint(73.8815, 18.5230)::geography, 'metro_station', 'Pune Railway Station', 'Aqua Line'),
        (pune_id, ST_MakePoint(73.8908, 18.5260)::geography, 'metro_station', 'Ruby Hall',           'Aqua Line'),
        (pune_id, ST_MakePoint(73.9000, 18.5285)::geography, 'metro_station', 'Bund Garden',         'Aqua Line'),
        (pune_id, ST_MakePoint(73.9085, 18.5340)::geography, 'metro_station', 'Yerawada',            'Aqua Line'),
        (pune_id, ST_MakePoint(73.9180, 18.5382)::geography, 'metro_station', 'Kalyani Nagar',       'Aqua Line'),
        (pune_id, ST_MakePoint(73.9290, 18.5430)::geography, 'metro_station', 'Ramwadi',             'Aqua Line');

    -- Key Railway Stations
    INSERT INTO transit_stops (city_id, location, stop_type, name, route_info) VALUES
        (pune_id, ST_MakePoint(73.8815, 18.5285)::geography, 'railway_station', 'Pune Junction',      'Central Railway'),
        (pune_id, ST_MakePoint(73.8507, 18.5337)::geography, 'railway_station', 'Shivajinagar Railway Station', 'Central Railway'),
        (pune_id, ST_MakePoint(73.8135, 18.5090)::geography, 'railway_station', 'Kothrud Railway Station', 'Central Railway');

END $$;
