-- ============================================================================
-- Migration 000009 DOWN: Revert Transit Stop Coordinate Fixes
-- ============================================================================
-- This is a no-op down migration since the original coordinates were approximate
-- and we don't want to revert to inaccurate data. The old coordinates are
-- preserved in migration 000008_transit_seed.up.sql for reference.
-- ============================================================================

-- No action needed — original approximate coordinates are not worth reverting to.
-- If a rollback is needed, re-run 000008_transit_seed.up.sql manually.
