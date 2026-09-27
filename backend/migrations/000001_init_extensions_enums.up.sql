-- ============================================================================
-- Migration 000001: Extensions, ENUM Types, and Utility Functions
-- ============================================================================
-- This is the foundation migration. All subsequent migrations depend on the
-- types defined here. ENUMs are chosen over check constraints for type safety,
-- indexability, and storage efficiency (4 bytes vs. variable-length strings).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "postgis";            -- Geospatial types & functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";           -- gen_random_uuid() for PK generation

-- ---------------------------------------------------------------------------
-- 2. ENUM Types — Property & Listing
-- ---------------------------------------------------------------------------
CREATE TYPE property_type AS ENUM (
    'APARTMENT',
    'INDEPENDENT_HOUSE',
    'PG',
    'CO_LIVING'
);

CREATE TYPE bhk_config AS ENUM (
    '1RK',
    '1BHK',
    '2BHK',
    '3BHK',
    '4BHK',
    '4PLUS_BHK',
    'STUDIO',
    'SINGLE_ROOM'
);

CREATE TYPE furnishing_level AS ENUM (
    'UNFURNISHED',
    'SEMI_FURNISHED',
    'FULLY_FURNISHED',
    'LUXURY_FURNISHED'
);

CREATE TYPE lease_duration AS ENUM (
    'SIX_MONTHS',
    'ELEVEN_MONTHS',
    'TWELVE_PLUS_MONTHS'
);

CREATE TYPE parking_type AS ENUM (
    'NONE',
    'TWO_WHEELER',
    'FOUR_WHEELER',
    'BOTH'
);

CREATE TYPE water_supply_type AS ENUM (
    'MUNICIPAL',
    'BOREWELL',
    'TANKER',
    'MIXED'
);

CREATE TYPE power_backup_type AS ENUM (
    'NONE',
    'INVERTER',
    'FULL_DG'
);

-- ---------------------------------------------------------------------------
-- 3. ENUM Types — User & Auth
-- ---------------------------------------------------------------------------
CREATE TYPE auth_status AS ENUM (
    'UNVERIFIED',
    'OTP_VERIFIED',
    'COMMUNITY_VERIFIED'
);

-- ---------------------------------------------------------------------------
-- 4. ENUM Types — Pin Lifecycle
-- ---------------------------------------------------------------------------
CREATE TYPE pin_status AS ENUM (
    'ACTIVE',
    'EXPIRED',
    'RESOLVED',     -- Found a flat / rented out
    'RENEWED'       -- Re-activated after expiry
);

-- ---------------------------------------------------------------------------
-- 5. ENUM Types — Flatmate Preferences
-- ---------------------------------------------------------------------------
CREATE TYPE food_preference AS ENUM (
    'VEG',
    'NON_VEG',
    'EGGETARIAN',
    'VEGAN'
);

CREATE TYPE smoking_preference AS ENUM (
    'YES',
    'NO',
    'OCCASIONAL'
);

CREATE TYPE pet_preference AS ENUM (
    'HAS_PETS',
    'NO_PETS',
    'PETS_WELCOME'
);

CREATE TYPE gender_preference AS ENUM (
    'MALE',
    'FEMALE',
    'ANY'
);

CREATE TYPE flatmate_listing_type AS ENUM (
    'HAS_ROOM',            -- Existing tenant with an available room
    'SEEKING_PARTNER'      -- Solo seeker looking for a co-renter
);

-- ---------------------------------------------------------------------------
-- 6. ENUM Types — Heatmap & To-Let
-- ---------------------------------------------------------------------------
CREATE TYPE heatmap_source AS ENUM (
    'SELF_REPORTED',
    'LISTING_CLOSED'
);

CREATE TYPE scrub_status AS ENUM (
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED'
);

-- ---------------------------------------------------------------------------
-- 7. ENUM Types — Matching
-- ---------------------------------------------------------------------------
CREATE TYPE match_status AS ENUM (
    'PENDING',
    'VIEWED',
    'CHAT_INITIATED',
    'EXPIRED',
    'REJECTED'
);

-- ---------------------------------------------------------------------------
-- 8. ENUM Types — Chat
-- ---------------------------------------------------------------------------
CREATE TYPE chat_room_type AS ENUM (
    'DIRECT',
    'GROUP'
);

CREATE TYPE chat_member_role AS ENUM (
    'MEMBER',
    'ADMIN'
);

CREATE TYPE message_content_type AS ENUM (
    'TEXT',
    'SYSTEM',       -- System-generated (e.g., "User joined the chat")
    'REDACTED',     -- PII was detected and scrubbed
    'IMAGE'
);

-- ---------------------------------------------------------------------------
-- 9. ENUM Types — Subscription
-- ---------------------------------------------------------------------------
CREATE TYPE subscription_status AS ENUM (
    'ACTIVE',
    'CANCELLED',
    'EXPIRED',
    'PAUSED'
);

-- ---------------------------------------------------------------------------
-- 10. Utility: Automatic updated_at trigger
-- ---------------------------------------------------------------------------
-- Attach this trigger to any table that has an `updated_at` column.
-- Usage: CREATE TRIGGER ... BEFORE UPDATE ON <table> FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
