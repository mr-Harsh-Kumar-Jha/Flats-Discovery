-- Migration 000014: Add sale listing columns to flat_pins and seed real sale units

ALTER TABLE flat_pins 
ADD COLUMN IF NOT EXISTS is_for_sale BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sale_price NUMERIC(12,2);

CREATE INDEX IF NOT EXISTS idx_flat_pins_is_for_sale ON flat_pins (is_for_sale) WHERE is_for_sale = true;

-- Seed genuine individual flats for sale across Pune, Mumbai, Gurgaon, Noida
INSERT INTO flat_pins (
    user_id, city_id, location, rent, sale_price, is_for_sale,
    bhk_config, property_type, furnishing, floor_number, total_floors,
    parking, water_supply, power_backup, status, description
)
VALUES
-- Pune Sale Units
(
    'a0000001-0000-0000-0000-000000000001',
    '22a633a6-afdd-447c-b017-760cc0a9b1d2',
    ST_SetSRID(ST_MakePoint(73.7431, 18.5824), 4326)::geography,
    28000.00,
    7800000.00,
    true,
    '2BHK',
    'APARTMENT',
    'SEMI_FURNISHED',
    6, 18,
    'FOUR_WHEELER',
    'MUNICIPAL',
    'FULL_DG',
    'ACTIVE',
    'Resale 2BHK in Blue Ridge Hinjewadi Phase 1. High floor overlooking golf course, modular kitchen, covered car park. Clear title.'
),
(
    'a0000001-0000-0000-0000-000000000002',
    '22a633a6-afdd-447c-b017-760cc0a9b1d2',
    ST_SetSRID(ST_MakePoint(73.7769, 18.5679), 4326)::geography,
    42000.00,
    13500000.00,
    true,
    '3BHK',
    'APARTMENT',
    'FULLY_FURNISHED',
    11, 22,
    'BOTH',
    'MUNICIPAL',
    'FULL_DG',
    'ACTIVE',
    'Luxury 3BHK for sale on Baner-Balewadi High Street. Italian marble, 2 covered parking, walking distance to Line 3 Metro Station.'
),

-- Mumbai Sale Units
(
    'a0000001-0000-0000-0000-000000000001',
    '11111111-2222-3333-4444-555555555555',
    ST_SetSRID(ST_MakePoint(72.9051, 19.1197), 4326)::geography,
    65000.00,
    26500000.00,
    true,
    '2BHK',
    'APARTMENT',
    'SEMI_FURNISHED',
    14, 28,
    'FOUR_WHEELER',
    'MUNICIPAL',
    'FULL_DG',
    'ACTIVE',
    '2BHK in Hiranandani Powai. Lake view, neoclassical architecture, 1050 sq.ft carpet, high rental yield from tech professionals.'
),
(
    'a0000001-0000-0000-0000-000000000002',
    '11111111-2222-3333-4444-555555555555',
    ST_SetSRID(ST_MakePoint(72.8258, 18.9953), 4326)::geography,
    110000.00,
    48000000.00,
    true,
    '3BHK',
    'APARTMENT',
    'FULLY_FURNISHED',
    25, 45,
    'BOTH',
    'MUNICIPAL',
    'FULL_DG',
    'ACTIVE',
    'Ultra-luxury 3BHK in Lower Parel / Worli corridor. High floor with Arabian Sea view, world-class clubhouse, 5 min to BKC connector.'
),

-- Gurgaon Sale Units
(
    'a0000001-0000-0000-0000-000000000001',
    'd29a52ff-9821-40bc-9761-36ad9ea1580a',
    ST_SetSRID(ST_MakePoint(77.0987, 28.4732), 4326)::geography,
    85000.00,
    32000000.00,
    true,
    '3BHK',
    'APARTMENT',
    'FULLY_FURNISHED',
    8, 20,
    'BOTH',
    'MUNICIPAL',
    'FULL_DG',
    'ACTIVE',
    'Direct owner 3BHK on Golf Course Road near One Horizon Centre. 2100 sq.ft, 3 parking bays, 2 min to Rapid Metro station.'
),

-- Noida Sale Units
(
    'a0000001-0000-0000-0000-000000000001',
    '9beb42ec-a567-42b5-bfc4-ed44066cd2a8',
    ST_SetSRID(ST_MakePoint(77.4172, 28.4975), 4326)::geography,
    32000.00,
    9500000.00,
    true,
    '3BHK',
    'APARTMENT',
    'SEMI_FURNISHED',
    12, 24,
    'FOUR_WHEELER',
    'MUNICIPAL',
    'FULL_DG',
    'ACTIVE',
    'Ready 3BHK flat on Noida Expressway Sector 142 near Advant Navis & Aqua Metro. High rental demand from IT MNCs.'
)
ON CONFLICT DO NOTHING;
