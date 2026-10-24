-- ============================================================================
-- Migration 000012: End-to-End Encrypted (E2EE) Messaging Support
-- ============================================================================
-- Adds cryptographic public identity key storage for users and enables
-- tamper-proof, zero-knowledge E2EE message payloads on chat_messages.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. User E2EE Public Keys (ECDH P-256)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_e2ee_keys (
    user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    public_key          TEXT NOT NULL,                      -- JWK JSON string of user's ECDH public key
    algorithm           VARCHAR(50) NOT NULL DEFAULT 'ECDH-P256',
    fingerprint         VARCHAR(64) NOT NULL,               -- SHA-256 hex fingerprint for identity verification
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_user_e2ee_keys_updated_at
    BEFORE UPDATE ON user_e2ee_keys
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_user_e2ee_keys_user ON user_e2ee_keys (user_id);

-- ---------------------------------------------------------------------------
-- 2. Chat Messages E2EE Metadata
-- ---------------------------------------------------------------------------
ALTER TABLE chat_messages
    ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS sender_pub_fingerprint VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_chat_messages_encrypted ON chat_messages (room_id, is_encrypted);
