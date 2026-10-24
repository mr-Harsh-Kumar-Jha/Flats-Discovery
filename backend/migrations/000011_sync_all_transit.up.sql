-- ============================================================================
-- Migration 000011: Synchronize all Pune Transit Stops (Metro, Rail, Airport, Bus)
-- ============================================================================

DO $$
DECLARE
    v_pune_id UUID;
BEGIN
    SELECT id INTO v_pune_id FROM cities WHERE slug = 'pune' LIMIT 1;
    IF v_pune_id IS NULL THEN
        RETURN;
    END IF;

    -- Remove fictional "Kothrud Railway Station"
    DELETE FROM transit_stops WHERE city_id = v_pune_id AND name ILIKE '%Kothrud%Railway%';

    -- 1. Upsert / Refresh Railway Stations
    INSERT INTO transit_stops (city_id, location, stop_type, name, route_info) VALUES
        (v_pune_id, ST_MakePoint(73.8744146, 18.5288773)::geography, 'railway_station', 'Pune Junction', 'Central Railway'),
        (v_pune_id, ST_MakePoint(73.8513115, 18.5325915)::geography, 'railway_station', 'Shivajinagar Railway Station', 'Central Railway'),
        (v_pune_id, ST_MakePoint(73.8385000, 18.5605000)::geography, 'railway_station', 'Khadki Railway Station', 'Central Railway'),
        (v_pune_id, ST_MakePoint(73.8326856, 18.5814473)::geography, 'railway_station', 'Dapodi Railway Station', 'Central Railway'),
        (v_pune_id, ST_MakePoint(73.8208678, 18.6080927)::geography, 'railway_station', 'Kasarwadi Railway Station', 'Central Railway'),
        (v_pune_id, ST_MakePoint(73.8025117, 18.6229526)::geography, 'railway_station', 'Pimpri Railway Station', 'Central Railway'),
        (v_pune_id, ST_MakePoint(73.7917128, 18.6403548)::geography, 'railway_station', 'Chinchwad Railway Station', 'Central Railway'),
        (v_pune_id, ST_MakePoint(73.7647160, 18.6486364)::geography, 'railway_station', 'Akurdi Railway Station', 'Central Railway'),
        (v_pune_id, ST_MakePoint(73.8939317, 18.5281480)::geography, 'railway_station', 'Ghorpuri Railway Station', 'Central Railway'),
        (v_pune_id, ST_MakePoint(73.9351000, 18.5147000)::geography, 'railway_station', 'Hadapsar Railway Station', 'Central Railway')
    ON CONFLICT DO NOTHING;

    -- Update railway stations coordinates in case they already exist
    UPDATE transit_stops SET location = ST_MakePoint(73.8744146, 18.5288773)::geography WHERE city_id = v_pune_id AND name = 'Pune Junction';
    UPDATE transit_stops SET location = ST_MakePoint(73.8513115, 18.5325915)::geography WHERE city_id = v_pune_id AND name = 'Shivajinagar Railway Station';

    -- 2. Upsert Pune International Airport
    DELETE FROM transit_stops WHERE city_id = v_pune_id AND stop_type = 'airport';
    INSERT INTO transit_stops (city_id, location, stop_type, name, route_info) VALUES
        (v_pune_id, ST_MakePoint(73.9197, 18.5822)::geography, 'airport', 'Pune International Airport (PNQ)', 'Air Terminal');

    -- 3. Upsert Major Bus Stands
    DELETE FROM transit_stops WHERE city_id = v_pune_id AND stop_type = 'bus_station';
    INSERT INTO transit_stops (city_id, location, stop_type, name, route_info) VALUES
        (v_pune_id, ST_MakePoint(73.8580, 18.5015)::geography, 'bus_station', 'Swargate ST Bus Stand & Depot', 'MSRTC & PMPML'),
        (v_pune_id, ST_MakePoint(73.8475, 18.5350)::geography, 'bus_station', 'Shivajinagar ST Bus Stand (Wakdewadi)', 'MSRTC & PMPML'),
        (v_pune_id, ST_MakePoint(73.8735, 18.5295)::geography, 'bus_station', 'Pune Station Bus Stand', 'PMPML & MSRTC'),
        (v_pune_id, ST_MakePoint(73.8560, 18.4550)::geography, 'bus_station', 'Katraj Bus Stand / Depot', 'PMPML Hub'),
        (v_pune_id, ST_MakePoint(73.9315, 18.5020)::geography, 'bus_station', 'Hadapsar Bus Stand (Gadital)', 'PMPML & ST'),
        (v_pune_id, ST_MakePoint(73.7650, 18.6540)::geography, 'bus_station', 'Nigdi Bus Terminal (Bhakti Shakti)', 'PMPML Hub'),
        (v_pune_id, ST_MakePoint(73.8060, 18.5045)::geography, 'bus_station', 'Kothrud Depot Bus Stand', 'PMPML Hub'),
        (v_pune_id, ST_MakePoint(73.9185, 18.5810)::geography, 'bus_station', 'Pune Airport AeroMall Bus Terminal', 'PMPML Airport Express'),
        (v_pune_id, ST_MakePoint(73.7380, 18.5910)::geography, 'bus_station', 'Hinjewadi Phase 1 Transit Hub', 'PMPML Hub');

END $$;
