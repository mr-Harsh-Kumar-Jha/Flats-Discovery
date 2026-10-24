-- ============================================================================
-- Migration 000012: Rollback E2EE Messaging Support
-- ============================================================================

DROP TRIGGER IF EXISTS trg_user_e2ee_keys_updated_at ON user_e2ee_keys;
DROP TABLE IF EXISTS user_e2ee_keys;

ALTER TABLE chat_messages
    DROP COLUMN IF EXISTS sender_pub_fingerprint,
    DROP COLUMN IF EXISTS is_encrypted;
