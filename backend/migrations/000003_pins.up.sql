-- ============================================================================
-- Migration 000003: All Pin Types (Geospatial Core)
-- ============================================================================
-- This is the geospatial heart of the system. All location columns use
-- GEOGRAPHY(Point, 4326) for spheroid-based distance calculations in meters.
--
-- GEOGRAPHY vs GEOMETRY decision rationale:
--   - GEOGRAPHY uses WGS84 spheroid → ST_DWithin returns TRUE/FALSE based on meters
--   - GEOMETRY uses planar math → would need ST_Transform to a local projection
--   - For Indian cities (lat ~18-28°N), GEOGRAPHY avoids per-city projection config
--   - Tradeoff: fewer functions support GEOGRAPHY, but we only need ST_DWithin,
--     ST_Distance, ST_Within, and bounding box ops (via ::geometry cast)
--
-- GIST indexes on GEOGRAPHY columns support:
--   - ST_DWithin (radius search)
--   - && operator via ::geometry cast (bounding box / map viewport)
--   - KNN ordering via <-> operator
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Seeker Pins — "I'm looking for a flat here"
-- ---------------------------------------------------------------------------
-- A seeker drops a pin on their desired location with preferences.
-- bhk_configs is an ARRAY to allow flexible searches (e.g., "2BHK or 3BHK").
-- property_types is an ARRAY for the same reason.
-- Max 3 active pins per user (enforced at application layer).
CREATE TABLE seeker_pins (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID                    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    city_id             UUID                    NOT NULL REFERENCES cities(id),

    -- Geospatial
    location            GEOGRAPHY(Point, 4326)  NOT NULL,
    search_radius_km    NUMERIC(5,2)            NOT NULL,   -- How far to search from this point

    -- Preferences
    budget_max          NUMERIC(10,2)           NOT NULL,   -- Max monthly rent in ₹
    budget_min          NUMERIC(10,2),                      -- Optional floor
    bhk_configs         bhk_config[]            NOT NULL,   -- e.g., ARRAY['2BHK', '3BHK']
    property_types      property_type[]         NOT NULL DEFAULT ARRAY['APARTMENT']::property_type[],
    furnishing_min      furnishing_level        NOT NULL DEFAULT 'UNFURNISHED',  -- Minimum acceptable
    preferred_move_in   DATE,                               -- Desired move-in date

    -- Lifecycle
    status              pin_status              NOT NULL DEFAULT 'ACTIVE',
    expires_at          TIMESTAMPTZ             NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    renewed_count       SMALLINT                NOT NULL DEFAULT 0,

    -- Metadata
    notes               TEXT,                               -- Free-text notes from seeker
    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT ck_seeker_budget CHECK (budget_max > 0),
    CONSTRAINT ck_seeker_budget_range CHECK (budget_min IS NULL OR budget_min <= budget_max),
    CONSTRAINT ck_seeker_radius CHECK (search_radius_km > 0 AND search_radius_km <= 25),
    CONSTRAINT ck_seeker_bhk_not_empty CHECK (array_length(bhk_configs, 1) > 0)
);

CREATE TRIGGER trg_seeker_pins_updated_at
    BEFORE UPDATE ON seeker_pins
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Spatial index: enables ST_DWithin and bounding box queries
CREATE INDEX idx_seeker_pins_location ON seeker_pins USING GIST (location);

-- Composite index: active pins for a user (pin cap enforcement)
CREATE INDEX idx_seeker_pins_user_active ON seeker_pins (user_id, status)
    WHERE status IN ('ACTIVE', 'RENEWED');

-- Expiry worker index: find pins that need expiry notifications
CREATE INDEX idx_seeker_pins_expires ON seeker_pins (expires_at)
    WHERE status IN ('ACTIVE', 'RENEWED');

-- City filter (API queries always scope by city)
CREATE INDEX idx_seeker_pins_city ON seeker_pins (city_id)
    WHERE status IN ('ACTIVE', 'RENEWED');

-- ---------------------------------------------------------------------------
-- 2. Flat Pins — "My flat is available here"
-- ---------------------------------------------------------------------------
-- An owner drops a pin on their flat's location with details.
-- Max 5 active pins per user (enforced at application layer).
CREATE TABLE flat_pins (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID                    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    city_id             UUID                    NOT NULL REFERENCES cities(id),

    -- Geospatial
    location            GEOGRAPHY(Point, 4326)  NOT NULL,

    -- Flat details
    rent                NUMERIC(10,2)           NOT NULL,   -- Monthly rent in ₹
    deposit_amount      NUMERIC(10,2),                      -- Security deposit in ₹
    bhk_config          bhk_config              NOT NULL,   -- Singular: a flat IS a specific BHK
    property_type       property_type           NOT NULL DEFAULT 'APARTMENT',
    furnishing          furnishing_level        NOT NULL DEFAULT 'UNFURNISHED',
    lease_duration      lease_duration,
    available_from      DATE,                               -- When the flat is available

    -- Building details
    floor_number        SMALLINT,                           -- 0 = ground floor
    total_floors        SMALLINT,
    parking             parking_type            NOT NULL DEFAULT 'NONE',
    water_supply        water_supply_type       NOT NULL DEFAULT 'MUNICIPAL',
    power_backup        power_backup_type       NOT NULL DEFAULT 'NONE',

    -- Lifecycle
    status              pin_status              NOT NULL DEFAULT 'ACTIVE',
    expires_at          TIMESTAMPTZ             NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    renewed_count       SMALLINT                NOT NULL DEFAULT 0,

    -- Metadata
    description         TEXT,
    image_urls          TEXT[],                             -- S3 keys for flat photos
    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT ck_flat_rent CHECK (rent > 0),
    CONSTRAINT ck_flat_deposit CHECK (deposit_amount IS NULL OR deposit_amount >= 0),
    CONSTRAINT ck_flat_floor CHECK (floor_number IS NULL OR floor_number >= 0),
    CONSTRAINT ck_flat_total_floors CHECK (total_floors IS NULL OR total_floors >= 1),
    CONSTRAINT ck_flat_floor_lte_total CHECK (
        floor_number IS NULL OR total_floors IS NULL OR floor_number <= total_floors
    )
);

CREATE TRIGGER trg_flat_pins_updated_at
    BEFORE UPDATE ON flat_pins
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Spatial index
CREATE INDEX idx_flat_pins_location ON flat_pins USING GIST (location);

-- Active pins per user (cap enforcement)
CREATE INDEX idx_flat_pins_user_active ON flat_pins (user_id, status)
    WHERE status IN ('ACTIVE', 'RENEWED');

-- Expiry worker
CREATE INDEX idx_flat_pins_expires ON flat_pins (expires_at)
    WHERE status IN ('ACTIVE', 'RENEWED');

-- City scoping
CREATE INDEX idx_flat_pins_city ON flat_pins (city_id)
    WHERE status IN ('ACTIVE', 'RENEWED');

-- Matchmaking engine: the workhorse query filters by BHK, rent, and status
CREATE INDEX idx_flat_pins_match_filter ON flat_pins (city_id, bhk_config, rent, status)
    WHERE status IN ('ACTIVE', 'RENEWED');

-- ---------------------------------------------------------------------------
-- 3. Rent Heatmap Pins — Anonymous rent data for market transparency
-- ---------------------------------------------------------------------------
-- Two sources:
--   SELF_REPORTED: current tenants anonymously report their rent
--   LISTING_CLOSED: auto-created when a flat_pin status → RESOLVED
--
-- These are ANONYMOUS: no user_id exposed in API responses.
-- The user_id is retained internally for abuse detection only.
CREATE TABLE rent_heatmap_pins (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID                    REFERENCES users(id) ON DELETE SET NULL,  -- nullable for privacy
    city_id             UUID                    NOT NULL REFERENCES cities(id),
    source_flat_pin_id  UUID                    REFERENCES flat_pins(id) ON DELETE SET NULL,  -- if LISTING_CLOSED

    -- Geospatial
    location            GEOGRAPHY(Point, 4326)  NOT NULL,

    -- Rent data
    rent                NUMERIC(10,2)           NOT NULL,
    bhk_config          bhk_config              NOT NULL,
    property_type       property_type           NOT NULL DEFAULT 'APARTMENT',
    source              heatmap_source          NOT NULL,

    -- Validity
    reported_at         DATE                    NOT NULL DEFAULT CURRENT_DATE,  -- When this rent was being paid
    is_verified         BOOLEAN                 NOT NULL DEFAULT false,         -- Cross-referenced with other data

    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT ck_heatmap_rent CHECK (rent > 0),
    CONSTRAINT ck_heatmap_source_flat CHECK (
        (source = 'LISTING_CLOSED' AND source_flat_pin_id IS NOT NULL) OR
        (source = 'SELF_REPORTED' AND source_flat_pin_id IS NULL)
    )
);

-- Spatial index for heatmap rendering (bounding box queries)
CREATE INDEX idx_heatmap_location ON rent_heatmap_pins USING GIST (location);

-- City + BHK filter (heatmap API typically filters by these)
CREATE INDEX idx_heatmap_city_bhk ON rent_heatmap_pins (city_id, bhk_config);

-- Temporal index for "rent trends" queries
CREATE INDEX idx_heatmap_reported_at ON rent_heatmap_pins (reported_at);

-- ---------------------------------------------------------------------------
-- 4. To-Let Boards — Crowdsourced photos of offline "To-Let" signs
-- ---------------------------------------------------------------------------
-- Users photograph To-Let signs they see while walking around.
-- The system:
--   1. Stores the raw image in a PRIVATE S3 bucket
--   2. Queues async AI scrubbing (face/license plate blur)
--   3. Serves a blurred placeholder until scrubbing completes
--   4. After scrubbing, serves the clean image from a PUBLIC S3 bucket
--
-- The transcribed_phone is the number written on the To-Let sign, NOT the uploader's phone.
CREATE TABLE to_let_boards (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploaded_by         UUID                    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    city_id             UUID                    NOT NULL REFERENCES cities(id),

    -- Geospatial
    location            GEOGRAPHY(Point, 4326)  NOT NULL,

    -- Image handling
    raw_image_key       TEXT                    NOT NULL,   -- S3 key in private bucket
    scrubbed_image_key  TEXT,                               -- S3 key in public bucket (after scrub)
    placeholder_key     TEXT,                               -- Blurred placeholder S3 key
    scrub_status        scrub_status            NOT NULL DEFAULT 'PENDING',
    scrub_error         TEXT,                               -- Error message if scrub failed
    scrubbed_at         TIMESTAMPTZ,

    -- Transcribed data
    transcribed_phone   VARCHAR(15),                        -- Phone from the sign (NOT uploader's)
    transcribed_text    TEXT,                                -- Any other text from the sign
    ai_transcribed      BOOLEAN                 NOT NULL DEFAULT false,  -- Was this auto-transcribed by AI?

    -- Metadata
    description         TEXT,
    is_active           BOOLEAN                 NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_to_let_boards_updated_at
    BEFORE UPDATE ON to_let_boards
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Spatial index
CREATE INDEX idx_to_let_boards_location ON to_let_boards USING GIST (location);

-- Scrubber worker: find pending items
CREATE INDEX idx_to_let_boards_scrub ON to_let_boards (scrub_status)
    WHERE scrub_status IN ('PENDING', 'FAILED');

-- City scoping
CREATE INDEX idx_to_let_boards_city ON to_let_boards (city_id)
    WHERE is_active = true;
