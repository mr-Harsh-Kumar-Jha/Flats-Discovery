-- ============================================================================
-- Migration 000008 DOWN
-- ============================================================================
-- WARNING: This will delete all transit stops AND all seeded cities.
-- Other tables have FK references to cities, so this will CASCADE.
-- Only run this if you're rolling back the entire schema.

DELETE FROM transit_stops;
DROP TABLE IF EXISTS transit_stops CASCADE;

-- Remove seeded cities (only safe if no other data references them)
-- In practice, this DOWN migration should only be run on a fresh database.
DELETE FROM cities WHERE slug IN ('pune', 'gurgaon', 'noida');
