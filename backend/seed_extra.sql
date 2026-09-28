INSERT INTO flatmate_profiles (user_id, city_id, flat_pin_id, listing_type, occupation, food, smoking, pets, gender, bio, current_occupants, rooms_available, languages) VALUES
('a0000001-0000-0000-0000-000000000001', '22a633a6-afdd-447c-b017-760cc0a9b1d2', 'f0000001-0000-0000-0000-000000000001', 'HAS_ROOM', 'Software Engineer at Infosys', 'VEG', 'NO', 'NO_PETS', 'MALE', 'Senior Dev at Infosys Hinjewadi. Looking for like-minded flatmate.', 1, 1, ARRAY['Hindi', 'Marathi', 'English']),
('a0000001-0000-0000-0000-000000000002', '22a633a6-afdd-447c-b017-760cc0a9b1d2', 'f0000001-0000-0000-0000-000000000002', 'HAS_ROOM', 'Product Manager at Google', 'NON_VEG', 'OCCASIONAL', 'PETS_WELCOME', 'ANY', 'Senior PM at Google. Love cooking, reading, weekend treks.', 2, 1, ARRAY['English', 'Hindi', 'Tamil']),
('a0000001-0000-0000-0000-000000000005', '22a633a6-afdd-447c-b017-760cc0a9b1d2', 'f0000001-0000-0000-0000-000000000005', 'HAS_ROOM', 'Data Scientist at TCS', 'EGGETARIAN', 'NO', 'NO_PETS', 'FEMALE', 'Lead Analyst at TCS Viman Nagar. Gym enthusiast.', 1, 1, ARRAY['English', 'Hindi', 'Marathi']),
('a0000001-0000-0000-0000-000000000007', '22a633a6-afdd-447c-b017-760cc0a9b1d2', 'f0000001-0000-0000-0000-000000000007', 'HAS_ROOM', 'Startup Founder - Fintech CEO', 'NON_VEG', 'NO', 'HAS_PETS', 'ANY', 'Running a fintech startup. Golden retriever named Max.', 1, 2, ARRAY['English', 'Hindi', 'Gujarati']),
('a0000001-0000-0000-0000-000000000001', '22a633a6-afdd-447c-b017-760cc0a9b1d2', 'f0000001-0000-0000-0000-000000000009', 'HAS_ROOM', 'Freelance UI/UX Designer', 'VEGAN', 'NO', 'NO_PETS', 'ANY', 'Night owl, love music and art. Studio fits two.', 0, 1, ARRAY['English', 'Hindi']);

INSERT INTO rent_heatmap_pins (user_id, city_id, location, rent, bhk_config, property_type, source) VALUES
('a0000001-0000-0000-0000-000000000001', '22a633a6-afdd-447c-b017-760cc0a9b1d2', ST_MakePoint(73.8076, 18.5039)::geography, 17000, '2BHK', 'APARTMENT', 'SELF_REPORTED'),
('a0000001-0000-0000-0000-000000000002', '22a633a6-afdd-447c-b017-760cc0a9b1d2', ST_MakePoint(73.8100, 18.5070)::geography, 19000, '2BHK', 'APARTMENT', 'SELF_REPORTED'),
('a0000001-0000-0000-0000-000000000003', '22a633a6-afdd-447c-b017-760cc0a9b1d2', ST_MakePoint(73.7979, 18.5550)::geography, 28000, '2BHK', 'APARTMENT', 'SELF_REPORTED'),
('a0000001-0000-0000-0000-000000000004', '22a633a6-afdd-447c-b017-760cc0a9b1d2', ST_MakePoint(73.7374, 18.5924)::geography, 11000, '1BHK', 'APARTMENT', 'SELF_REPORTED'),
('a0000001-0000-0000-0000-000000000005', '22a633a6-afdd-447c-b017-760cc0a9b1d2', ST_MakePoint(73.9143, 18.5679)::geography, 23000, '2BHK', 'APARTMENT', 'SELF_REPORTED'),
('a0000001-0000-0000-0000-000000000006', '22a633a6-afdd-447c-b017-760cc0a9b1d2', ST_MakePoint(73.9057, 18.5445)::geography, 38000, '3BHK', 'APARTMENT', 'SELF_REPORTED'),
('a0000001-0000-0000-0000-000000000007', '22a633a6-afdd-447c-b017-760cc0a9b1d2', ST_MakePoint(73.8918, 18.5362)::geography, 16000, 'STUDIO', 'APARTMENT', 'SELF_REPORTED'),
('a0000001-0000-0000-0000-000000000008', '22a633a6-afdd-447c-b017-760cc0a9b1d2', ST_MakePoint(73.8575, 18.4997)::geography, 8500, '1BHK', 'APARTMENT', 'SELF_REPORTED');
