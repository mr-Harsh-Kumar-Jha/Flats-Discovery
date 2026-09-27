-- ============================================================================
-- Migration 000002 DOWN: Drop Users, OTP, Refresh Tokens, Cities
-- ============================================================================

DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS otp_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS cities CASCADE;
