-- ============================================================================
-- Migration 000002: Cities (Reference) and Users
-- ============================================================================
-- Cities is a feature-flagged reference table. Users is the identity table.
-- A user is identified by phone number. Email is optional.
-- No fixed role — any user can drop seeker or owner pins.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Cities — Reference table with feature flag
-- ---------------------------------------------------------------------------
-- Adding a new city = INSERT + SET is_active = true. No schema change needed.
-- The center_point and bounding box are used for default map viewport.
CREATE TABLE cities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100)            NOT NULL,
    slug            VARCHAR(50)             NOT NULL,   -- URL-friendly: 'pune', 'gurgaon', 'noida'
    state           VARCHAR(100)            NOT NULL,
    country         VARCHAR(10)             NOT NULL DEFAULT 'IN',
    center_point    GEOGRAPHY(Point, 4326)  NOT NULL,   -- Default map center for this city
    default_zoom    SMALLINT                NOT NULL DEFAULT 12,
    is_active       BOOLEAN                 NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_cities_name UNIQUE (name),
    CONSTRAINT uq_cities_slug UNIQUE (slug),
    CONSTRAINT ck_cities_zoom CHECK (default_zoom BETWEEN 1 AND 22)
);

CREATE TRIGGER trg_cities_updated_at
    BEFORE UPDATE ON cities
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Users
-- ---------------------------------------------------------------------------
-- phone is the primary identity. Format: country code + number, e.g. '+919876543210'.
-- display_name is computed from first_name + last initial (application layer).
-- is_premium is denormalized here for fast middleware checks;
-- the source of truth is the subscriptions table (migration 000007).
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone           VARCHAR(15)             NOT NULL,   -- E.164 format: +919876543210
    email           VARCHAR(255),                       -- Optional, for notifications
    first_name      VARCHAR(100)            NOT NULL,
    last_name       VARCHAR(100),
    display_name    VARCHAR(110)            NOT NULL,    -- "Raj P." — generated on write
    auth_status     auth_status             NOT NULL DEFAULT 'UNVERIFIED',
    is_premium      BOOLEAN                 NOT NULL DEFAULT false,
    city_id         UUID                    NOT NULL REFERENCES cities(id),
    avatar_url      TEXT,
    created_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_users_phone UNIQUE (phone),
    CONSTRAINT uq_users_email UNIQUE (email)
);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Index for auth lookups (OTP verification flow)
CREATE INDEX idx_users_phone ON users (phone);
CREATE INDEX idx_users_city_id ON users (city_id);
CREATE INDEX idx_users_auth_status ON users (auth_status);

-- ---------------------------------------------------------------------------
-- 3. OTP Verification Tokens
-- ---------------------------------------------------------------------------
-- Short-lived tokens for phone verification. Cleaned up by a background job.
CREATE TABLE otp_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone           VARCHAR(15)             NOT NULL,
    otp_hash        VARCHAR(255)            NOT NULL,   -- bcrypt hash of the OTP
    attempts        SMALLINT                NOT NULL DEFAULT 0,
    max_attempts    SMALLINT                NOT NULL DEFAULT 3,
    expires_at      TIMESTAMPTZ             NOT NULL,
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_otp_attempts CHECK (attempts <= max_attempts)
);

CREATE INDEX idx_otp_tokens_phone_expires ON otp_tokens (phone, expires_at);

-- ---------------------------------------------------------------------------
-- 4. Refresh Tokens (JWT rotation)
-- ---------------------------------------------------------------------------
-- Each refresh token is single-use. On rotation, the old token is revoked.
-- If a revoked token is reused, ALL tokens for that user are revoked (theft detection).
CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID                    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255)            NOT NULL,   -- SHA-256 hash of the token
    family_id       UUID                    NOT NULL,   -- Groups tokens in a rotation chain
    is_revoked      BOOLEAN                 NOT NULL DEFAULT false,
    expires_at      TIMESTAMPTZ             NOT NULL,
    created_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_refresh_token_hash UNIQUE (token_hash)
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_family_id ON refresh_tokens (family_id);
