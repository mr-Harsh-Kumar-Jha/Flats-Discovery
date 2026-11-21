-- ============================================================================
-- Migration 000013: Flatmate Swipes (Tinder for Flatmates) and Housing Societies
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Flatmate Swipes (Mutual Matchmaking Engine)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flatmate_swipes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    swiper_id           UUID                    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id           UUID                    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    swipe_type          VARCHAR(20)             NOT NULL, -- 'LIKE', 'PASS', 'SUPERLIKE'
    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_flatmate_swipe UNIQUE (swiper_id, target_id),
    CONSTRAINT ck_no_self_swipe CHECK (swiper_id != target_id)
);

CREATE INDEX IF NOT EXISTS idx_flatmate_swipes_swiper ON flatmate_swipes (swiper_id);
CREATE INDEX IF NOT EXISTS idx_flatmate_swipes_target ON flatmate_swipes (target_id, swipe_type);

-- ---------------------------------------------------------------------------
-- 2. Housing Societies (Flat-Finder Architecture for Pune)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS housing_societies (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id             UUID                    NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    name                VARCHAR(200)            NOT NULL,
    slug                VARCHAR(200)            NOT NULL,
    locality            VARCHAR(100)            NOT NULL,
    location            GEOGRAPHY(Point, 4326)  NOT NULL,
    towers_count        INT                     DEFAULT 4,
    units_count         INT                     DEFAULT 250,
    min_rent            NUMERIC(10,2)           NOT NULL,
    max_rent            NUMERIC(10,2)           NOT NULL,
    min_price           NUMERIC(12,2)           NOT NULL, -- In INR for property buying / selling
    max_price           NUMERIC(12,2)           NOT NULL,
    avg_price_per_sqft  NUMERIC(10,2)           NOT NULL,
    rental_yield_pct    NUMERIC(4,2)            NOT NULL, -- e.g., 3.25%
    price_to_rent_ratio NUMERIC(5,2)            NOT NULL, -- e.g., 24.5 (P/R ratio)
    nearest_metro_station VARCHAR(100),
    metro_distance_meters INT,
    metro_line          VARCHAR(50),            -- 'PURPLE', 'AQUA', 'LINE3'
    office_commute      JSONB,                  -- {"hinjewadi": 14, "magarpatta": 35, "kharadi": 40}
    amenities           TEXT[],
    min_bedroom_dims    VARCHAR(50)             DEFAULT '11x12', -- Flat-finder signature bedroom dimension
    min_sqft            INT                     DEFAULT 950,
    max_sqft            INT                     DEFAULT 2400,
    rera_id             VARCHAR(100),
    verified_source     VARCHAR(100)            DEFAULT 'MahaRERA Plan',
    rating              NUMERIC(3,2)            DEFAULT 4.5,
    description         TEXT,
    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_housing_societies_location ON housing_societies USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_housing_societies_city ON housing_societies (city_id);

-- ---------------------------------------------------------------------------
-- 3. Seed Premier Pune Housing Societies
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_city_id UUID;
BEGIN
    SELECT id INTO v_city_id FROM cities WHERE slug = 'pune' LIMIT 1;
    IF v_city_id IS NOT NULL THEN
        INSERT INTO housing_societies (
            city_id, name, slug, locality, location, towers_count, units_count,
            min_rent, max_rent, min_price, max_price, avg_price_per_sqft,
            rental_yield_pct, price_to_rent_ratio, nearest_metro_station,
            metro_distance_meters, metro_line, office_commute, amenities,
            min_bedroom_dims, min_sqft, max_sqft, rera_id, verified_source, rating, description
        ) VALUES
        (
            v_city_id, 'Amanora Park Town', 'amanora-park-town', 'Hadapsar',
            ST_MakePoint(73.9312, 18.5186)::geography, 24, 3200,
            24000, 65000, 7500000, 22000000, 8500,
            3.40, 26.0, 'Ramwadi (Aqua Line Feeder)', 4200, 'AQUA',
            '{"hinjewadi": 55, "magarpatta": 8, "kharadi": 22}'::jsonb,
            ARRAY['swimming_pool', 'gym', 'clubhouse', 'tennis', 'power_backup', 'park', 'shopping'],
            '12x14', 1050, 2800, 'P52100000012', 'MahaRERA Plan', 4.7,
            '400-acre integrated township in Hadapsar near Magarpatta City with lakes, schools, and malls.'
        ),
        (
            v_city_id, 'Megapolis Mystic', 'megapolis-mystic', 'Hinjewadi Phase 3',
            ST_MakePoint(73.6934, 18.5912)::geography, 14, 1600,
            16000, 36000, 4800000, 9800000, 6800,
            3.80, 22.5, 'Megapolis Circle (Line 3)', 400, 'LINE3',
            '{"hinjewadi": 5, "baner": 25, "magarpatta": 55}'::jsonb,
            ARRAY['swimming_pool', 'gym', 'clubhouse', 'badminton', 'power_backup', 'bus_shuttle'],
            '11x12', 880, 1550, 'P52100000456', 'OCR Floor Plan', 4.4,
            'Modern high-rise society inside Hinjewadi Phase 3 IT corridor. Walk to major tech firms.'
        ),
        (
            v_city_id, 'Blue Ridge Paranjape', 'blue-ridge-paranjape', 'Hinjewadi Phase 1',
            ST_MakePoint(73.7374, 18.5835)::geography, 28, 4000,
            22000, 52000, 6800000, 16500000, 7900,
            3.60, 24.0, 'Hinjewadi Phase 1 (Line 3)', 600, 'LINE3',
            '{"hinjewadi": 2, "baner": 18, "magarpatta": 50}'::jsonb,
            ARRAY['golf_course', 'swimming_pool', 'gym', 'clubhouse', 'tennis', 'school'],
            '11x13', 950, 2100, 'P52100000789', 'MahaRERA Plan', 4.6,
            'Self-contained township in Hinjewadi Phase 1 with golf course, riverside walk, and Symbiosis.'
        ),
        (
            v_city_id, 'Godrej Infinity', 'godrej-infinity', 'Keshav Nagar',
            ST_MakePoint(73.9485, 18.5367)::geography, 8, 950,
            20000, 45000, 6200000, 13500000, 7400,
            3.50, 25.0, 'Kalyani Nagar (Aqua Line)', 3200, 'AQUA',
            '{"kharadi": 12, "magarpatta": 15, "hinjewadi": 50}'::jsonb,
            ARRAY['swimming_pool', 'gym', 'clubhouse', 'jogging', 'power_backup', 'river_view'],
            '11x12', 900, 1800, 'P52100000321', 'MahaRERA Plan', 4.5,
            'Riverside township near Kharadi and Magarpatta with panoramic river views and Godrej amenities.'
        ),
        (
            v_city_id, 'Kolte Patil Life Republic', 'kolte-patil-life-republic', 'Marunji - Hinjewadi',
            ST_MakePoint(73.7123, 18.6189)::geography, 32, 4500,
            14000, 32000, 4200000, 9200000, 6200,
            3.75, 23.0, 'Wakad Metro (Line 3 Feeder)', 2800, 'LINE3',
            '{"hinjewadi": 10, "wakad": 12, "baner": 22}'::jsonb,
            ARRAY['swimming_pool', 'gym', 'clubhouse', 'cricket_pitch', 'nature_park'],
            '10x11', 820, 1600, 'P52100000999', 'Direct Tenant', 4.3,
            'Sprawling green township near Hinjewadi with school, sports arenas, and family-friendly living.'
        ),
        (
            v_city_id, 'Rohan Mithila', 'rohan-mithila', 'Viman Nagar',
            ST_MakePoint(73.9118, 18.5684)::geography, 12, 850,
            28000, 60000, 8500000, 19500000, 9200,
            3.30, 27.0, 'Ramwadi Metro (Aqua Line)', 700, 'AQUA',
            '{"kharadi": 15, "magarpatta": 20, "airport": 8}'::jsonb,
            ARRAY['swimming_pool', 'gym', 'clubhouse', 'landscaped_gardens', 'power_backup'],
            '12x13', 1100, 2400, 'P52100000111', 'MahaRERA Plan', 4.6,
            'Premium residential project in central Viman Nagar. 700m to Pune Metro Aqua Line and Phoenix Mall.'
        ),
        (
            v_city_id, 'Kasturi The Balmoral', 'kasturi-the-balmoral', 'Baner',
            ST_MakePoint(73.7842, 18.5714)::geography, 6, 320,
            42000, 95000, 14000000, 35000000, 12500,
            2.90, 31.0, 'Baner Metro (Line 3)', 900, 'LINE3',
            '{"hinjewadi": 16, "baner_high_st": 3, "senapati_bapat": 18}'::jsonb,
            ARRAY['infinity_pool', 'gym', 'squash', 'concierge', 'spa', 'full_dg'],
            '13x16', 1650, 3800, 'P52100000222', 'MahaRERA Plan', 4.9,
            'Ultra-luxury gated estate on Balewadi High Street with concierge, private elevators, and Italian finishes.'
        )
        ON CONFLICT DO NOTHING;

        -- -------------------------------------------------------------------
        -- 4. Seed Seeking Partner Flatmates (Co-Renters)
        -- -------------------------------------------------------------------
        INSERT INTO flatmate_profiles (
            user_id, city_id, seeker_pin_id, listing_type, occupation, food,
            smoking, pets, gender, bio, room_rent, languages
        )
        SELECT
            sp.user_id,
            sp.city_id,
            sp.id,
            'SEEKING_PARTNER'::flatmate_listing_type,
            'Analyst at Barclays Kharadi',
            'VEG'::food_preference,
            'NO'::smoking_preference,
            'NO_PETS'::pet_preference,
            'MALE'::gender_preference,
            'Working at Barclays EON Kharadi. Looking to team up for a 2BHK in Viman Nagar or Kharadi. Non-smoker, clean habits.',
            15000,
            ARRAY['English', 'Hindi']
        FROM seeker_pins sp
        WHERE sp.user_id = 'a0000001-0000-0000-0000-000000000004'
        ON CONFLICT (seeker_pin_id) DO NOTHING;

        INSERT INTO flatmate_profiles (
            user_id, city_id, seeker_pin_id, listing_type, occupation, food,
            smoking, pets, gender, bio, room_rent, languages
        )
        SELECT
            sp.user_id,
            sp.city_id,
            sp.id,
            'SEEKING_PARTNER'::flatmate_listing_type,
            'Frontend Engineer at Swiggy',
            'NON_VEG'::food_preference,
            'NO'::smoking_preference,
            'PETS_WELCOME'::pet_preference,
            'ANY'::gender_preference,
            'Looking for a roommate to co-rent a 2BHK in Baner or Wakad. Love gaming, good coffee, and weekend treks.',
            18000,
            ARRAY['English', 'Hindi', 'Marathi']
        FROM seeker_pins sp
        WHERE sp.user_id = 'a0000001-0000-0000-0000-000000000006'
        ON CONFLICT (seeker_pin_id) DO NOTHING;

    END IF;
END $$;
