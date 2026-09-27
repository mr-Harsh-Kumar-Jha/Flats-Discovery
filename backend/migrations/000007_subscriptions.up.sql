-- ============================================================================
-- Migration 000007: Subscriptions (Abstract Billing)
-- ============================================================================
-- Billing provider is deferred. Pricing model is deferred.
-- This is the minimal subscription table needed for the is_premium flag
-- and to record subscription state transitions.
--
-- The Go application layer uses a PaymentProvider interface.
-- This table stores the result of payment operations, not the payment logic.
-- ============================================================================

CREATE TABLE subscriptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID                    NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Subscription state
    status              subscription_status     NOT NULL DEFAULT 'ACTIVE',
    starts_at           TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    ends_at             TIMESTAMPTZ             NOT NULL,
    cancelled_at        TIMESTAMPTZ,

    -- External provider (abstracted)
    provider            VARCHAR(50),            -- 'razorpay', 'stripe', NULL for manual/gifted
    external_id         VARCHAR(255),           -- Provider's subscription/payment ID
    plan_name           VARCHAR(100),           -- 'monthly_premium', 'trial_7d', etc.

    -- Pricing snapshot (what the user agreed to at time of purchase)
    amount_paid         NUMERIC(10,2),          -- In ₹
    currency            VARCHAR(3)              NOT NULL DEFAULT 'INR',

    -- Auto-renewal
    auto_renew          BOOLEAN                 NOT NULL DEFAULT false,

    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- User's subscription history
CREATE INDEX idx_subscriptions_user ON subscriptions (user_id, status);

-- Active subscriptions (for the background worker that syncs users.is_premium)
CREATE INDEX idx_subscriptions_active ON subscriptions (ends_at)
    WHERE status = 'ACTIVE';

-- External provider lookup (for webhook reconciliation)
CREATE INDEX idx_subscriptions_external ON subscriptions (provider, external_id)
    WHERE external_id IS NOT NULL;
