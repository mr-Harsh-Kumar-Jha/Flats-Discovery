-- Clean up seeded test data
DELETE FROM flatmate_profiles WHERE user_id LIKE 'a0000001-%';
DELETE FROM rent_heatmap_pins WHERE user_id LIKE 'a0000001-%';
DELETE FROM seeker_pins WHERE user_id LIKE 'a0000001-%';
DELETE FROM flat_pins WHERE user_id LIKE 'a0000001-%';
DELETE FROM users WHERE id LIKE 'a0000001-%';
