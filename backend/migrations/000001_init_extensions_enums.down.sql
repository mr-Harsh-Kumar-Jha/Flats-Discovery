-- ============================================================================
-- Migration 000001 DOWN: Drop all ENUMs, functions, and extensions
-- ============================================================================
-- Order matters: drop dependents first, then types, then extensions.
-- Tables that depend on these types must be dropped by their own down migrations first.
-- ============================================================================

DROP FUNCTION IF EXISTS set_updated_at() CASCADE;

DROP TYPE IF EXISTS subscription_status CASCADE;
DROP TYPE IF EXISTS message_content_type CASCADE;
DROP TYPE IF EXISTS chat_member_role CASCADE;
DROP TYPE IF EXISTS chat_room_type CASCADE;
DROP TYPE IF EXISTS match_status CASCADE;
DROP TYPE IF EXISTS scrub_status CASCADE;
DROP TYPE IF EXISTS heatmap_source CASCADE;
DROP TYPE IF EXISTS flatmate_listing_type CASCADE;
DROP TYPE IF EXISTS gender_preference CASCADE;
DROP TYPE IF EXISTS pet_preference CASCADE;
DROP TYPE IF EXISTS smoking_preference CASCADE;
DROP TYPE IF EXISTS food_preference CASCADE;
DROP TYPE IF EXISTS pin_status CASCADE;
DROP TYPE IF EXISTS auth_status CASCADE;
DROP TYPE IF EXISTS power_backup_type CASCADE;
DROP TYPE IF EXISTS water_supply_type CASCADE;
DROP TYPE IF EXISTS parking_type CASCADE;
DROP TYPE IF EXISTS lease_duration CASCADE;
DROP TYPE IF EXISTS furnishing_level CASCADE;
DROP TYPE IF EXISTS bhk_config CASCADE;
DROP TYPE IF EXISTS property_type CASCADE;

-- NOTE: We do NOT drop the postgis or pgcrypto extensions here.
-- Other schemas/tables may depend on them, and dropping them CASCADE
-- would silently destroy data. Handle extension removal manually.
