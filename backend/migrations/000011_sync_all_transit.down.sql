-- Rollback migration 11
DELETE FROM transit_stops WHERE stop_type IN ('airport', 'bus_station');
