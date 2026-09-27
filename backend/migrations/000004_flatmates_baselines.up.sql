-- ============================================================================
-- Migration 000004: Flatmate Profiles and User Baselines
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Flatmate Profiles
-- ---------------------------------------------------------------------------
-- Two flows:
--   HAS_ROOM:         Existing tenant with an available room → links to flat_pin
--   SEEKING_PARTNER:  Solo seeker looking for a co-renter   → links to seeker_pin
--
-- The CHECK constraint enforces referential integrity based on the listing type.
-- This avoids a polymorphic FK (which can't be enforced by the DB).
CREATE TABLE flatmate_profiles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID                    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    city_id             UUID                    NOT NULL REFERENCES cities(id),

    -- Listing type determines which FK is populated
    listing_type        flatmate_listing_type   NOT NULL,
    flat_pin_id         UUID                    REFERENCES flat_pins(id) ON DELETE CASCADE,
    seeker_pin_id       UUID                    REFERENCES seeker_pins(id) ON DELETE CASCADE,

    -- Lifestyle preferences (for compatibility matching)
    food                food_preference         NOT NULL,
    smoking             smoking_preference      NOT NULL,
    pets                pet_preference          NOT NULL,
    gender              gender_preference       NOT NULL,

    -- Additional preferences
    age_min             SMALLINT,               -- Preferred flatmate age range
    age_max             SMALLINT,
    occupation          VARCHAR(100),           -- e.g., "IT Professional", "Student"
    languages           TEXT[],                 -- Spoken languages: ARRAY['Hindi', 'Marathi', 'English']

    -- Room details (for HAS_ROOM type)
    room_rent           NUMERIC(10,2),          -- Per-person rent if sharing
    rooms_available     SMALLINT,               -- How many rooms are available
    current_occupants   SMALLINT,               -- How many people already live there

    -- Lifecycle (inherits from parent pin, but can be independently deactivated)
    is_active           BOOLEAN                 NOT NULL DEFAULT true,

    -- Metadata
    bio                 TEXT,                   -- Short self-description
    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    -- Constraints: enforce the correct FK based on listing type
    CONSTRAINT ck_flatmate_fk_integrity CHECK (
        (listing_type = 'HAS_ROOM' AND flat_pin_id IS NOT NULL AND seeker_pin_id IS NULL) OR
        (listing_type = 'SEEKING_PARTNER' AND seeker_pin_id IS NOT NULL AND flat_pin_id IS NULL)
    ),
    CONSTRAINT ck_flatmate_age CHECK (
        (age_min IS NULL AND age_max IS NULL) OR
        (age_min IS NOT NULL AND age_max IS NOT NULL AND age_min <= age_max AND age_min >= 18)
    ),
    CONSTRAINT ck_flatmate_room_rent CHECK (room_rent IS NULL OR room_rent > 0),
    -- One active flatmate profile per pin (no duplicates)
    CONSTRAINT uq_flatmate_flat_pin UNIQUE (flat_pin_id),
    CONSTRAINT uq_flatmate_seeker_pin UNIQUE (seeker_pin_id)
);

CREATE TRIGGER trg_flatmate_profiles_updated_at
    BEFORE UPDATE ON flatmate_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- User's active profiles
CREATE INDEX idx_flatmate_user_active ON flatmate_profiles (user_id)
    WHERE is_active = true;

-- City scoping
CREATE INDEX idx_flatmate_city ON flatmate_profiles (city_id)
    WHERE is_active = true;

-- Lifestyle matching queries: filter by preferences
CREATE INDEX idx_flatmate_lifestyle ON flatmate_profiles (city_id, listing_type, food, smoking, gender)
    WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- 2. User Baselines — Lifestyle Upgrade Engine
-- ---------------------------------------------------------------------------
-- Stores the user's CURRENT living situation so the matchmaking engine
-- can calculate whether a match represents a net upgrade.
--
-- One baseline per user. If they move, they update it.
-- The commute_destination is a point (their workplace/college).
CREATE TABLE user_baselines (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID                    NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Current living situation
    current_rent            NUMERIC(10,2)           NOT NULL,
    current_furnishing      furnishing_level        NOT NULL,
    current_bhk             bhk_config              NOT NULL,
    current_property_type   property_type           NOT NULL DEFAULT 'APARTMENT',

    -- Commute
    commute_destination     GEOGRAPHY(Point, 4326),             -- Workplace/college location
    commute_destination_name VARCHAR(200),                       -- "Hinjewadi Phase 1", "Magarpatta City"
    current_commute_km      NUMERIC(5,2),                       -- Current commute distance in km

    -- Quality of life
    current_parking         parking_type            DEFAULT 'NONE',
    current_water_supply    water_supply_type       DEFAULT 'MUNICIPAL',
    current_power_backup    power_backup_type       DEFAULT 'NONE',

    created_at              TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    -- One baseline per user
    CONSTRAINT uq_baseline_user UNIQUE (user_id),
    CONSTRAINT ck_baseline_rent CHECK (current_rent > 0),
    CONSTRAINT ck_baseline_commute CHECK (current_commute_km IS NULL OR current_commute_km >= 0)
);

CREATE TRIGGER trg_user_baselines_updated_at
    BEFORE UPDATE ON user_baselines
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
