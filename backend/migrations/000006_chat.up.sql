-- ============================================================================
-- Migration 000006: Chat System
-- ============================================================================
-- Chat is geofenced: users can only chat if a system match exists.
-- Supports both DIRECT (1:1 per match) and GROUP (flatmate discussions).
--
-- Architecture:
--   chat_rooms         → The room itself (type, linked match)
--   chat_room_members  → Who is in the room (junction table)
--   chat_messages      → Messages within a room
--
-- PII scrubbing happens at the application layer (WebSocket handler).
-- Messages with detected PII are stored with content_type = 'REDACTED'
-- and the original_content is preserved for admin review.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Chat Rooms
-- ---------------------------------------------------------------------------
CREATE TABLE chat_rooms (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id            UUID                    REFERENCES matches(id) ON DELETE SET NULL,  -- NULL for group chats not tied to a specific match
    room_type           chat_room_type          NOT NULL DEFAULT 'DIRECT',
    name                VARCHAR(200),           -- Display name (used for group chats)

    -- Room state
    is_active           BOOLEAN                 NOT NULL DEFAULT true,
    last_message_at     TIMESTAMPTZ,            -- Denormalized for sort order

    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_chat_rooms_updated_at
    BEFORE UPDATE ON chat_rooms
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- One DIRECT room per match (prevent duplicates)
CREATE UNIQUE INDEX uq_chat_rooms_match ON chat_rooms (match_id)
    WHERE room_type = 'DIRECT' AND match_id IS NOT NULL;

-- User's room list (sorted by last message)
CREATE INDEX idx_chat_rooms_last_message ON chat_rooms (last_message_at DESC)
    WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- 2. Chat Room Members
-- ---------------------------------------------------------------------------
CREATE TABLE chat_room_members (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id             UUID                    NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id             UUID                    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role                chat_member_role        NOT NULL DEFAULT 'MEMBER',

    -- Member state
    joined_at           TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    last_read_at        TIMESTAMPTZ,            -- For unread count calculation
    is_muted            BOOLEAN                 NOT NULL DEFAULT false,
    left_at             TIMESTAMPTZ,            -- NULL if still in room

    -- A user can only be in a room once
    CONSTRAINT uq_room_member UNIQUE (room_id, user_id)
);

-- Fetch all rooms for a user (active members only)
CREATE INDEX idx_room_members_user ON chat_room_members (user_id)
    WHERE left_at IS NULL;

-- Fetch all members of a room (for broadcasting messages)
CREATE INDEX idx_room_members_room ON chat_room_members (room_id)
    WHERE left_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Chat Messages
-- ---------------------------------------------------------------------------
CREATE TABLE chat_messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id             UUID                    NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id           UUID                    NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Content
    content             TEXT                    NOT NULL,       -- The displayed message (scrubbed if PII detected)
    original_content    TEXT,                                   -- Original text before PII scrubbing (admin access only)
    content_type        message_content_type    NOT NULL DEFAULT 'TEXT',

    -- Media (for IMAGE type)
    media_url           TEXT,                                   -- S3 key for attached media

    -- PII detection metadata
    pii_detected        BOOLEAN                 NOT NULL DEFAULT false,
    pii_patterns        TEXT[],                                 -- What patterns were detected: ['phone', 'email']

    -- Delivery state
    -- NOTE: Per-user read status is tracked via chat_room_members.last_read_at
    -- combined with message.created_at. This avoids an N×M read receipts table.

    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

    -- No updated_at: messages are immutable once sent (edits would be a new message type)
    CONSTRAINT ck_msg_content_length CHECK (length(content) <= 5000),
    CONSTRAINT ck_msg_media CHECK (
        (content_type = 'IMAGE' AND media_url IS NOT NULL) OR
        (content_type != 'IMAGE')
    )
);

-- Fetch messages in a room (paginated, newest first)
CREATE INDEX idx_messages_room_time ON chat_messages (room_id, created_at DESC);

-- PII audit: find all redacted messages for admin review
CREATE INDEX idx_messages_pii ON chat_messages (created_at)
    WHERE pii_detected = true;

-- Sender's message history (for moderation)
CREATE INDEX idx_messages_sender ON chat_messages (sender_id, created_at DESC);
