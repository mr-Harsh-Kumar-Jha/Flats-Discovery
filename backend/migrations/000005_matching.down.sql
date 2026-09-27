-- ============================================================================
-- Migration 000005 DOWN
-- ============================================================================

DROP TABLE IF EXISTS notification_queue CASCADE;
DROP TABLE IF EXISTS match_queue CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
