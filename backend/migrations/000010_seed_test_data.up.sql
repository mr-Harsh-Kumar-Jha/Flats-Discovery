-- ============================================================================
-- Migration 000010: Seed Initial Development & Test Data
-- ============================================================================
-- Automatically seeds:
--   1. Pune city (resolved dynamically or inserted)
--   2. 8 Test users (with verified auth status)
--   3. 15 Curated flat pins across Pune localities
--   4. Flatmate profiles (lifestyle, food, smoking, occupation)
--   5. Seeker pins (budgets, BHK preferences, search radiuses)
--   6. Rent heatmap baseline data
-- ============================================================================

DO $$
DECLARE
    v_city_id UUID;
BEGIN
    -- 1. Resolve or ensure Pune city exists
    SELECT id INTO v_city_id FROM cities WHERE slug = 'pune' LIMIT 1;
    IF v_city_id IS NULL THEN
        INSERT INTO cities (id, name, slug, state, country, center_point, default_zoom, is_active)
        VALUES (
            '22a633a6-afdd-447c-b017-760cc0a9b1d2',
            'Pune',
            'pune',
            'Maharashtra',
            'IN',
            ST_MakePoint(73.8567, 18.5204)::geography,
            12,
            true
        )
        RETURNING id INTO v_city_id;
    END IF;

    -- Clean up existing seed data if present
    DELETE FROM flatmate_profiles WHERE user_id::text LIKE 'a0000001-%';
    DELETE FROM rent_heatmap_pins WHERE user_id::text LIKE 'a0000001-%';
    DELETE FROM seeker_pins WHERE user_id::text LIKE 'a0000001-%';
    DELETE FROM flat_pins WHERE user_id::text LIKE 'a0000001-%';
    DELETE FROM users WHERE id::text LIKE 'a0000001-%';

    -- 2. Insert Test Users
    INSERT INTO users (id, phone, first_name, last_name, display_name, auth_status, city_id) VALUES
    ('a0000001-0000-0000-0000-000000000001', '+919876543001', 'Raj', 'Patel', 'Raj P.', 'OTP_VERIFIED', v_city_id),
    ('a0000001-0000-0000-0000-000000000002', '+919876543002', 'Priya', 'Sharma', 'Priya S.', 'OTP_VERIFIED', v_city_id),
    ('a0000001-0000-0000-0000-000000000003', '+919876543003', 'Amit', 'Kulkarni', 'Amit K.', 'OTP_VERIFIED', v_city_id),
    ('a0000001-0000-0000-0000-000000000004', '+919876543004', 'Sneha', 'Deshmukh', 'Sneha D.', 'OTP_VERIFIED', v_city_id),
    ('a0000001-0000-0000-0000-000000000005', '+919876543005', 'Arjun', 'Joshi', 'Arjun J.', 'OTP_VERIFIED', v_city_id),
    ('a0000001-0000-0000-0000-000000000006', '+919876543006', 'Meera', 'Rane', 'Meera R.', 'OTP_VERIFIED', v_city_id),
    ('a0000001-0000-0000-0000-000000000007', '+919876543007', 'Vikram', 'Bhosle', 'Vikram B.', 'OTP_VERIFIED', v_city_id),
    ('a0000001-0000-0000-0000-000000000008', '+919876543008', 'Ananya', 'Iyer', 'Ananya I.', 'OTP_VERIFIED', v_city_id)
    ON CONFLICT (phone) DO UPDATE SET city_id = EXCLUDED.city_id;

    -- 3. Insert Flat Pins (15 across key Pune hubs)
    INSERT INTO flat_pins (id, user_id, city_id, location, rent, deposit_amount, bhk_config, property_type, furnishing, parking, water_supply, power_backup, floor_number, total_floors, description, available_from) VALUES
    ('f0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000001', v_city_id, ST_MakePoint(73.8076, 18.5039)::geography, 18000, 50000, '2BHK', 'APARTMENT', 'SEMI_FURNISHED', 'TWO_WHEELER', 'MUNICIPAL', 'INVERTER', 3, 7, 'Spacious 2BHK in Kothrud near Karve Road. Walking distance to Deccan. Good for IT professionals.', '2026-10-15'),
    ('f0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000002', v_city_id, ST_MakePoint(73.7979, 18.5550)::geography, 35000, 100000, '3BHK', 'APARTMENT', 'FULLY_FURNISHED', 'BOTH', 'MUNICIPAL', 'FULL_DG', 12, 18, 'Premium 3BHK in Baner, Amanora Park Town. Gym, pool, clubhouse. 24x7 water and power.', NULL),
    ('f0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000003', v_city_id, ST_MakePoint(73.7374, 18.5924)::geography, 12000, 24000, '1BHK', 'APARTMENT', 'SEMI_FURNISHED', 'TWO_WHEELER', 'BOREWELL', 'NONE', 2, 5, 'Affordable 1BHK near Hinjewadi IT Park Phase 1. 5 min walk to Wipro/Infosys gate.', NULL),
    ('f0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000004', v_city_id, ST_MakePoint(73.7576, 18.5903)::geography, 16000, 32000, '2BHK', 'APARTMENT', 'UNFURNISHED', 'FOUR_WHEELER', 'MIXED', 'INVERTER', 5, 10, 'New 2BHK in Wakad near Dange Chowk. Metro station 500m away.', NULL),
    ('f0000001-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000005', v_city_id, ST_MakePoint(73.9143, 18.5679)::geography, 22000, 66000, '2BHK', 'APARTMENT', 'FULLY_FURNISHED', 'BOTH', 'MUNICIPAL', 'FULL_DG', NULL, NULL, 'Fully furnished 2BHK in Viman Nagar. Close to Phoenix Mall and airport.', NULL),
    ('f0000001-0000-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000006', v_city_id, ST_MakePoint(73.9228, 18.5037)::geography, 8500, NULL, '1BHK', 'PG', 'FULLY_FURNISHED', 'NONE', 'TANKER', 'NONE', NULL, NULL, 'PG accommodation in Hadapsar near Magarpatta. Includes meals, WiFi, housekeeping.', NULL),
    ('f0000001-0000-0000-0000-000000000007', 'a0000001-0000-0000-0000-000000000007', v_city_id, ST_MakePoint(73.9057, 18.5445)::geography, 42000, 126000, '3BHK', 'APARTMENT', 'LUXURY_FURNISHED', 'BOTH', 'MUNICIPAL', 'FULL_DG', 8, 14, 'Luxury 3BHK in Kalyani Nagar with river view. Italian marble flooring.', NULL),
    ('f0000001-0000-0000-0000-000000000008', 'a0000001-0000-0000-0000-000000000008', v_city_id, ST_MakePoint(73.8068, 18.5585)::geography, 20000, 40000, '2BHK', 'APARTMENT', 'SEMI_FURNISHED', 'FOUR_WHEELER', 'MUNICIPAL', 'INVERTER', NULL, NULL, 'Well-maintained 2BHK in Aundh near Bremen Chowk. Good for families.', NULL),
    ('f0000001-0000-0000-0000-000000000009', 'a0000001-0000-0000-0000-000000000001', v_city_id, ST_MakePoint(73.8918, 18.5362)::geography, 15000, NULL, 'STUDIO', 'APARTMENT', 'FULLY_FURNISHED', 'NONE', 'MUNICIPAL', 'INVERTER', NULL, NULL, 'Cozy studio in Koregaon Park. Walking distance to German Bakery and Osho Ashram.', NULL),
    ('f0000001-0000-0000-0000-000000000010', 'a0000001-0000-0000-0000-000000000002', v_city_id, ST_MakePoint(73.7881, 18.5987)::geography, 14500, 29000, '2BHK', 'APARTMENT', 'UNFURNISHED', 'TWO_WHEELER', 'BOREWELL', 'NONE', 1, 4, 'Budget 2BHK in Pimple Saudagar. Near D-Mart and schools. No brokers.', NULL),
    ('f0000001-0000-0000-0000-000000000011', 'a0000001-0000-0000-0000-000000000003', v_city_id, ST_MakePoint(73.8497, 18.5322)::geography, 6500, NULL, '1RK', 'INDEPENDENT_HOUSE', 'UNFURNISHED', 'NONE', 'MUNICIPAL', 'NONE', NULL, NULL, '1RK in Shivajinagar near FC Road. Metro station 2 min walk.', NULL),
    ('f0000001-0000-0000-0000-000000000012', 'a0000001-0000-0000-0000-000000000004', v_city_id, ST_MakePoint(73.8003, 18.4895)::geography, 13000, 26000, '2BHK', 'APARTMENT', 'SEMI_FURNISHED', 'TWO_WHEELER', 'MUNICIPAL', 'NONE', NULL, NULL, 'Clean 2BHK in Warje near NDA gate. Quiet locality.', NULL),
    ('f0000001-0000-0000-0000-000000000013', 'a0000001-0000-0000-0000-000000000005', v_city_id, ST_MakePoint(73.8575, 18.4997)::geography, 9000, NULL, '1BHK', 'APARTMENT', 'UNFURNISHED', 'NONE', 'MUNICIPAL', 'NONE', NULL, NULL, 'Affordable 1BHK near Swargate bus stand and metro station.', '2026-10-01'),
    ('f0000001-0000-0000-0000-000000000014', 'a0000001-0000-0000-0000-000000000006', v_city_id, ST_MakePoint(73.7706, 18.6522)::geography, 11000, 22000, '2BHK', 'APARTMENT', 'UNFURNISHED', 'FOUR_WHEELER', 'MUNICIPAL', 'NONE', 4, 12, '2BHK in Nigdi PCMC area. Near Bhakti Shakti metro station.', NULL),
    ('f0000001-0000-0000-0000-000000000015', 'a0000001-0000-0000-0000-000000000007', v_city_id, ST_MakePoint(73.8836, 18.4625)::geography, 7000, NULL, 'SINGLE_ROOM', 'CO_LIVING', 'FULLY_FURNISHED', 'NONE', 'TANKER', 'NONE', NULL, NULL, 'Co-living space in Kondhwa. Shared kitchen, laundry, WiFi. Young professionals.', NULL)
    ON CONFLICT (id) DO NOTHING;

    -- 4. Insert Flatmate Profiles
    INSERT INTO flatmate_profiles (user_id, city_id, flat_pin_id, listing_type, occupation, food, smoking, pets, gender, bio, current_occupants, rooms_available, languages) VALUES
    ('a0000001-0000-0000-0000-000000000001', v_city_id, 'f0000001-0000-0000-0000-000000000001', 'HAS_ROOM', 'Software Engineer at Infosys', 'VEG', 'NO', 'NO_PETS', 'MALE', 'Working at Infosys Hinjewadi. Looking for a like-minded flatmate who values cleanliness.', 1, 1, ARRAY['Hindi', 'Marathi', 'English']),
    ('a0000001-0000-0000-0000-000000000002', v_city_id, 'f0000001-0000-0000-0000-000000000002', 'HAS_ROOM', 'Product Manager at Google', 'NON_VEG', 'OCCASIONAL', 'PETS_WELCOME', 'ANY', 'Product manager at Google. Love cooking, reading, and weekend treks around Pune.', 2, 1, ARRAY['English', 'Hindi', 'Tamil']),
    ('a0000001-0000-0000-0000-000000000005', v_city_id, 'f0000001-0000-0000-0000-000000000005', 'HAS_ROOM', 'Data Scientist at TCS', 'EGGETARIAN', 'NO', 'NO_PETS', 'FEMALE', 'Data scientist at TCS Viman Nagar. Gym enthusiast, early riser.', 1, 1, ARRAY['English', 'Hindi', 'Marathi']),
    ('a0000001-0000-0000-0000-000000000007', v_city_id, 'f0000001-0000-0000-0000-000000000007', 'HAS_ROOM', 'Startup Founder - Fintech CEO', 'NON_VEG', 'NO', 'HAS_PETS', 'ANY', 'Running a fintech startup. Have a friendly golden retriever named Max.', 1, 2, ARRAY['English', 'Hindi', 'Gujarati']),
    ('a0000001-0000-0000-0000-000000000001', v_city_id, 'f0000001-0000-0000-0000-000000000009', 'HAS_ROOM', 'Freelance UI/UX Designer', 'VEGAN', 'NO', 'NO_PETS', 'ANY', 'Freelance UI/UX designer. Night owl, love music and art.', 0, 1, ARRAY['English', 'Hindi'])
    ON CONFLICT (flat_pin_id) DO NOTHING;

    -- 5. Insert Seeker Pins
    INSERT INTO seeker_pins (user_id, city_id, location, search_radius_km, budget_max, budget_min, bhk_configs, property_types, furnishing_min, notes) VALUES
    ('a0000001-0000-0000-0000-000000000001', v_city_id, ST_MakePoint(73.8076, 18.5039)::geography, 3.0, 20000, 12000, ARRAY['1BHK','2BHK']::bhk_config[], ARRAY['APARTMENT']::property_type[], 'SEMI_FURNISHED', 'Looking for flat near Kothrud. Work at Infosys Hinjewadi.'),
    ('a0000001-0000-0000-0000-000000000002', v_city_id, ST_MakePoint(73.7979, 18.5550)::geography, 5.0, 15000, NULL, ARRAY['1BHK']::bhk_config[], ARRAY['APARTMENT','PG']::property_type[], 'UNFURNISHED', 'Budget 1BHK in Baner-Balewadi area. New to Pune.'),
    ('a0000001-0000-0000-0000-000000000003', v_city_id, ST_MakePoint(73.8918, 18.5362)::geography, 2.0, 30000, 20000, ARRAY['2BHK','3BHK']::bhk_config[], ARRAY['APARTMENT']::property_type[], 'FULLY_FURNISHED', 'Furnished flat in KP or Kalyani Nagar. Couple, both in IT.'),
    ('a0000001-0000-0000-0000-000000000004', v_city_id, ST_MakePoint(73.9143, 18.5679)::geography, 4.0, 18000, 10000, ARRAY['1BHK','STUDIO']::bhk_config[], ARRAY['APARTMENT','CO_LIVING']::property_type[], 'SEMI_FURNISHED', 'Solo professional near Viman Nagar. Prefer metro-connected.'),
    ('a0000001-0000-0000-0000-000000000005', v_city_id, ST_MakePoint(73.8575, 18.4997)::geography, 3.0, 10000, 5000, ARRAY['1RK','1BHK']::bhk_config[], ARRAY['APARTMENT','INDEPENDENT_HOUSE']::property_type[], 'UNFURNISHED', 'Student at COEP. Need cheap accommodation near Swargate.'),
    ('a0000001-0000-0000-0000-000000000006', v_city_id, ST_MakePoint(73.7576, 18.5903)::geography, 5.0, 25000, 15000, ARRAY['2BHK','3BHK']::bhk_config[], ARRAY['APARTMENT']::property_type[], 'SEMI_FURNISHED', 'Family of 3 looking in Wakad-Hinjewadi. Need parking.'),
    ('a0000001-0000-0000-0000-000000000007', v_city_id, ST_MakePoint(73.8068, 18.5585)::geography, 2.5, 22000, 18000, ARRAY['2BHK']::bhk_config[], ARRAY['APARTMENT']::property_type[], 'SEMI_FURNISHED', 'Couple looking in Aundh-Baner. Both work in Hinjewadi.'),
    ('a0000001-0000-0000-0000-000000000008', v_city_id, ST_MakePoint(73.8497, 18.5322)::geography, 1.5, 8000, 5000, ARRAY['1RK','SINGLE_ROOM']::bhk_config[], ARRAY['PG','CO_LIVING']::property_type[], 'FULLY_FURNISHED', 'Fresh grad looking for PG near FC Road. Need meals.');

    -- 6. Insert Heatmap Pins
    INSERT INTO rent_heatmap_pins (user_id, city_id, location, rent, bhk_config, property_type, source) VALUES
    ('a0000001-0000-0000-0000-000000000001', v_city_id, ST_MakePoint(73.8076, 18.5039)::geography, 17000, '2BHK', 'APARTMENT', 'SELF_REPORTED'),
    ('a0000001-0000-0000-0000-000000000002', v_city_id, ST_MakePoint(73.8100, 18.5070)::geography, 19000, '2BHK', 'APARTMENT', 'SELF_REPORTED'),
    ('a0000001-0000-0000-0000-000000000003', v_city_id, ST_MakePoint(73.8050, 18.5010)::geography, 15000, '1BHK', 'APARTMENT', 'SELF_REPORTED'),
    ('a0000001-0000-0000-0000-000000000004', v_city_id, ST_MakePoint(73.7979, 18.5550)::geography, 28000, '2BHK', 'APARTMENT', 'SELF_REPORTED'),
    ('a0000001-0000-0000-0000-000000000005', v_city_id, ST_MakePoint(73.7950, 18.5520)::geography, 32000, '3BHK', 'APARTMENT', 'SELF_REPORTED'),
    ('a0000001-0000-0000-0000-000000000006', v_city_id, ST_MakePoint(73.7374, 18.5924)::geography, 11000, '1BHK', 'APARTMENT', 'SELF_REPORTED'),
    ('a0000001-0000-0000-0000-000000000007', v_city_id, ST_MakePoint(73.9143, 18.5679)::geography, 23000, '2BHK', 'APARTMENT', 'SELF_REPORTED'),
    ('a0000001-0000-0000-0000-000000000008', v_city_id, ST_MakePoint(73.9057, 18.5445)::geography, 38000, '3BHK', 'APARTMENT', 'SELF_REPORTED'),
    ('a0000001-0000-0000-0000-000000000001', v_city_id, ST_MakePoint(73.8918, 18.5362)::geography, 16000, 'STUDIO', 'APARTMENT', 'SELF_REPORTED'),
    ('a0000001-0000-0000-0000-000000000002', v_city_id, ST_MakePoint(73.8575, 18.4997)::geography, 8500, '1BHK', 'APARTMENT', 'SELF_REPORTED');

END $$;
