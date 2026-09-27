-- ============================================================================
-- Migration 000005: Matches and the Match Queue
-- ============================================================================
-- The matches table is the output of the matchmaking engine.
-- It stores the Opportunity Value (OV) score AND its individual components
-- for debugging, transparency, and potential frontend display.
--
-- The match_queue table is the internal job queue for the background worker.
-- When a pin is created/updated, a row is inserted into match_queue.
-- The worker processes the queue and populates the matches table.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Matches
-- ---------------------------------------------------------------------------
CREATE TABLE matches (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seeker_pin_id       UUID                    NOT NULL REFERENCES seeker_pins(id) ON DELETE CASCADE,
    flat_pin_id         UUID                    NOT NULL REFERENCES flat_pins(id) ON DELETE CASCADE,
    seeker_user_id      UUID                    NOT NULL REFERENCES users(id),   -- Denormalized for fast lookups
    flat_user_id        UUID                    NOT NULL REFERENCES users(id),   -- Denormalized for fast lookups
    city_id             UUID                    NOT NULL REFERENCES cities(id),

    -- Opportunity Value score (composite)
    opportunity_value   NUMERIC(6,4)            NOT NULL,   -- 0.0000 to ~1.5000 (can exceed 1 with bonuses)

    -- Individual score components (stored for transparency & debugging)
    distance_score      NUMERIC(5,4)            NOT NULL,   -- 0.0 to 1.0
    budget_score        NUMERIC(5,4)            NOT NULL,   -- 0.0 to 1.0
    furnishing_score    NUMERIC(5,4)            NOT NULL,   -- 0.0 to 1.0 (includes upgrade bonus)
    transit_score       NUMERIC(5,4),                       -- 0.0 to 1.0 (NULL if no transit data)

    -- Computed distances (useful for frontend display)
    distance_meters     NUMERIC(10,2)           NOT NULL,   -- Actual distance between pins
    commute_delta_km    NUMERIC(6,2),                       -- Change in commute vs baseline (negative = improvement)

    -- Upgrade tags (set by the Lifestyle Upgrade Engine)
    is_furnishing_upgrade   BOOLEAN             NOT NULL DEFAULT false,
    is_commute_upgrade      BOOLEAN             NOT NULL DEFAULT false,
    is_net_positive         BOOLEAN             NOT NULL DEFAULT false,  -- Overall upgrade despite tradeoffs

    -- Status
    status              match_status            NOT NULL DEFAULT 'PENDING',
    viewed_at           TIMESTAMPTZ,
    chat_initiated_at   TIMESTAMPTZ,

    -- Metadata
    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    -- A match is unique per seeker-flat pair
    CONSTRAINT uq_match_pair UNIQUE (seeker_pin_id, flat_pin_id),
    CONSTRAINT ck_match_distance CHECK (distance_meters >= 0),
    CONSTRAINT ck_match_ov CHECK (opportunity_value >= 0)
);

CREATE TRIGGER trg_matches_updated_at
    BEFORE UPDATE ON matches
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- User's matches (both sides)
CREATE INDEX idx_matches_seeker_user ON matches (seeker_user_id, status);
CREATE INDEX idx_matches_flat_user ON matches (flat_user_id, status);

-- Pin-level lookups (when a pin is resolved, expire all its matches)
CREATE INDEX idx_matches_seeker_pin ON matches (seeker_pin_id);
CREATE INDEX idx_matches_flat_pin ON matches (flat_pin_id);

-- City scoping
CREATE INDEX idx_matches_city ON matches (city_id);

-- Ranking: fetch top matches sorted by OV score
CREATE INDEX idx_matches_ov_score ON matches (seeker_user_id, opportunity_value DESC)
    WHERE status = 'PENDING';

-- ---------------------------------------------------------------------------
-- 2. Match Queue — Internal job queue for the background worker
-- ---------------------------------------------------------------------------
-- This is a simple DB-backed job queue. When a pin is created, a trigger
-- (or application code) inserts a row here. The background worker polls
-- this table, processes matches, and marks jobs as completed.
--
-- For MVP scale, this is more than sufficient. To scale beyond ~10K
-- concurrent pins, replace with Redis/NATS streams (same interface).
CREATE TABLE match_queue (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_type        VARCHAR(20)             NOT NULL,   -- 'new_seeker_pin', 'new_flat_pin', 'pin_updated'
    pin_id              UUID                    NOT NULL,   -- The pin that triggered matching
    pin_table           VARCHAR(20)             NOT NULL,   -- 'seeker_pins' or 'flat_pins'
    city_id             UUID                    NOT NULL REFERENCES cities(id),
    priority            SMALLINT                NOT NULL DEFAULT 0,  -- Higher = process first (premium users get 10)

    -- Processing state
    status              VARCHAR(20)             NOT NULL DEFAULT 'PENDING',  -- PENDING, PROCESSING, COMPLETED, FAILED
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    error_message       TEXT,
    retry_count         SMALLINT                NOT NULL DEFAULT 0,
    max_retries         SMALLINT                NOT NULL DEFAULT 3,

    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT ck_queue_pin_table CHECK (pin_table IN ('seeker_pins', 'flat_pins')),
    CONSTRAINT ck_queue_status CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    CONSTRAINT ck_queue_retries CHECK (retry_count <= max_retries)
);

-- Worker polling: grab the next job (PENDING, oldest first, highest priority first)
-- FOR UPDATE SKIP LOCKED pattern for concurrent workers
CREATE INDEX idx_match_queue_pending ON match_queue (priority DESC, created_at ASC)
    WHERE status = 'PENDING';

-- Cleanup: find old completed jobs for periodic deletion
CREATE INDEX idx_match_queue_completed ON match_queue (completed_at)
    WHERE status = 'COMPLETED';

-- ---------------------------------------------------------------------------
-- 3. Notification Queue — Outbound notifications for matches
-- ---------------------------------------------------------------------------
-- When a match is created, a notification is queued here.
-- Premium users get priority: INSTANT (WebSocket push).
-- Free users get: BATCH (aggregated hourly digest).
CREATE TABLE notification_queue (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID                    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_id            UUID                    NOT NULL REFERENCES matches(id) ON DELETE CASCADE,

    -- Delivery
    channel             VARCHAR(20)             NOT NULL,   -- 'websocket', 'email', 'push'
    priority            VARCHAR(10)             NOT NULL DEFAULT 'BATCH',  -- 'INSTANT' or 'BATCH'
    payload             JSONB                   NOT NULL,   -- Notification content (denormalized for fast delivery)

    -- Processing state
    status              VARCHAR(20)             NOT NULL DEFAULT 'PENDING',
    sent_at             TIMESTAMPTZ,
    error_message       TEXT,

    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_notif_channel CHECK (channel IN ('websocket', 'email', 'push')),
    CONSTRAINT ck_notif_priority CHECK (priority IN ('INSTANT', 'BATCH')),
    CONSTRAINT ck_notif_status CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED'))
);

-- Dispatcher: grab pending notifications by priority
CREATE INDEX idx_notif_queue_pending ON notification_queue (priority, created_at)
    WHERE status = 'PENDING';

-- User's notification history
CREATE INDEX idx_notif_queue_user ON notification_queue (user_id, created_at DESC);
