-- ============================================================================
-- Migration 000006 DOWN
-- ============================================================================

DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_room_members CASCADE;
DROP TABLE IF EXISTS chat_rooms CASCADE;
