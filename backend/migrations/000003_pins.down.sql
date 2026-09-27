-- ============================================================================
-- Migration 000003 DOWN: Drop all pin tables
-- ============================================================================

DROP TABLE IF EXISTS to_let_boards CASCADE;
DROP TABLE IF EXISTS rent_heatmap_pins CASCADE;
DROP TABLE IF EXISTS flat_pins CASCADE;
DROP TABLE IF EXISTS seeker_pins CASCADE;
