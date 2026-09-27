package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"pune-flats/backend/internal/model"
)

// FlatPinRepository handles flat_pins CRUD and spatial queries.
type FlatPinRepository struct {
	pool *pgxpool.Pool
}

// NewFlatPinRepository creates a new FlatPinRepository.
func NewFlatPinRepository(pool *pgxpool.Pool) *FlatPinRepository {
	return &FlatPinRepository{pool: pool}
}

// Create inserts a new flat pin and returns the created record.
func (r *FlatPinRepository) Create(ctx context.Context, userID, cityID string, req *model.CreateFlatPinRequest) (*model.FlatPin, error) {
	var pin model.FlatPin
	err := r.pool.QueryRow(ctx, `
		INSERT INTO flat_pins (
			user_id, city_id, location,
			rent, deposit_amount, bhk_config, property_type, furnishing,
			lease_duration, available_from, floor_number, total_floors,
			parking, water_supply, power_backup, description
		) VALUES (
			$1, $2, ST_MakePoint($3, $4)::geography,
			$5, $6, $7::bhk_config, $8::property_type, $9::furnishing_level,
			$10::lease_duration, $11::date, $12, $13,
			$14::parking_type, $15::water_supply_type, $16::power_backup_type, $17
		)
		RETURNING id, user_id, city_id,
		          ST_Y(location::geometry), ST_X(location::geometry),
		          rent, deposit_amount, bhk_config::text, property_type::text, furnishing::text,
		          lease_duration::text, available_from::text, floor_number, total_floors,
		          parking::text, water_supply::text, power_backup::text,
		          status::text, expires_at, description, created_at, updated_at
	`,
		userID, cityID, req.Lng, req.Lat, // NOTE: ST_MakePoint(lng, lat)
		req.Rent, req.DepositAmount, req.BHKConfig, req.PropertyType, req.Furnishing,
		req.LeaseDuration, req.AvailableFrom, req.FloorNumber, req.TotalFloors,
		req.Parking, req.WaterSupply, req.PowerBackup, req.Description,
	).Scan(
		&pin.ID, &pin.UserID, &pin.CityID,
		&pin.Lat, &pin.Lng,
		&pin.Rent, &pin.DepositAmount, &pin.BHKConfig, &pin.PropertyType, &pin.Furnishing,
		&pin.LeaseDuration, &pin.AvailableFrom, &pin.FloorNumber, &pin.TotalFloors,
		&pin.Parking, &pin.WaterSupply, &pin.PowerBackup,
		&pin.Status, &pin.ExpiresAt, &pin.Description, &pin.CreatedAt, &pin.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("inserting flat pin: %w", err)
	}
	return &pin, nil
}

// GetByID returns a single flat pin by ID.
func (r *FlatPinRepository) GetByID(ctx context.Context, id string) (*model.FlatPin, error) {
	var pin model.FlatPin
	err := r.pool.QueryRow(ctx, `
		SELECT id, user_id, city_id,
		       ST_Y(location::geometry), ST_X(location::geometry),
		       rent, deposit_amount, bhk_config::text, property_type::text, furnishing::text,
		       lease_duration::text, available_from::text, floor_number, total_floors,
		       parking::text, water_supply::text, power_backup::text,
		       status::text, expires_at, description, image_urls, created_at, updated_at
		FROM flat_pins
		WHERE id = $1
	`, id).Scan(
		&pin.ID, &pin.UserID, &pin.CityID,
		&pin.Lat, &pin.Lng,
		&pin.Rent, &pin.DepositAmount, &pin.BHKConfig, &pin.PropertyType, &pin.Furnishing,
		&pin.LeaseDuration, &pin.AvailableFrom, &pin.FloorNumber, &pin.TotalFloors,
		&pin.Parking, &pin.WaterSupply, &pin.PowerBackup,
		&pin.Status, &pin.ExpiresAt, &pin.Description, &pin.ImageURLs, &pin.CreatedAt, &pin.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("fetching flat pin %s: %w", id, err)
	}
	return &pin, nil
}

// ListInBBox returns flat pins within the map viewport bounding box.
// Results are capped at `limit` and filtered by city + active status.
func (r *FlatPinRepository) ListInBBox(ctx context.Context, cityID string, bbox model.BBox, p model.PaginationParams) ([]model.FlatPin, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, city_id,
		       ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
		       rent, deposit_amount, bhk_config::text, property_type::text, furnishing::text,
		       lease_duration::text, available_from::text, floor_number, total_floors,
		       parking::text, water_supply::text, power_backup::text,
		       status::text, expires_at, description, created_at
		FROM flat_pins
		WHERE city_id = $1
		  AND status IN ('ACTIVE', 'RENEWED')
		  AND location::geometry && ST_MakeEnvelope($2, $3, $4, $5, 4326)
		ORDER BY rent ASC
		LIMIT $6 OFFSET $7
	`, cityID, bbox.SWLng, bbox.SWLat, bbox.NELng, bbox.NELat, p.Limit, p.Offset)
	if err != nil {
		return nil, fmt.Errorf("listing flat pins in bbox: %w", err)
	}
	defer rows.Close()

	var pins []model.FlatPin
	for rows.Next() {
		var pin model.FlatPin
		if err := rows.Scan(
			&pin.ID, &pin.CityID,
			&pin.Lat, &pin.Lng,
			&pin.Rent, &pin.DepositAmount, &pin.BHKConfig, &pin.PropertyType, &pin.Furnishing,
			&pin.LeaseDuration, &pin.AvailableFrom, &pin.FloorNumber, &pin.TotalFloors,
			&pin.Parking, &pin.WaterSupply, &pin.PowerBackup,
			&pin.Status, &pin.ExpiresAt, &pin.Description, &pin.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning flat pin row: %w", err)
		}
		pins = append(pins, pin)
	}
	return pins, rows.Err()
}

// ListInPolygon returns flat pins within a GeoJSON polygon.
func (r *FlatPinRepository) ListInPolygon(ctx context.Context, cityID string, geoJSON string, p model.PaginationParams) ([]model.FlatPin, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, city_id,
		       ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
		       rent, deposit_amount, bhk_config::text, property_type::text, furnishing::text,
		       lease_duration::text, available_from::text, floor_number, total_floors,
		       parking::text, water_supply::text, power_backup::text,
		       status::text, expires_at, description, created_at
		FROM flat_pins
		WHERE city_id = $1
		  AND status IN ('ACTIVE', 'RENEWED')
		  AND ST_Within(location::geometry, ST_GeomFromGeoJSON($2))
		ORDER BY rent ASC
		LIMIT $3 OFFSET $4
	`, cityID, geoJSON, p.Limit, p.Offset)
	if err != nil {
		return nil, fmt.Errorf("listing flat pins in polygon: %w", err)
	}
	defer rows.Close()

	var pins []model.FlatPin
	for rows.Next() {
		var pin model.FlatPin
		if err := rows.Scan(
			&pin.ID, &pin.CityID,
			&pin.Lat, &pin.Lng,
			&pin.Rent, &pin.DepositAmount, &pin.BHKConfig, &pin.PropertyType, &pin.Furnishing,
			&pin.LeaseDuration, &pin.AvailableFrom, &pin.FloorNumber, &pin.TotalFloors,
			&pin.Parking, &pin.WaterSupply, &pin.PowerBackup,
			&pin.Status, &pin.ExpiresAt, &pin.Description, &pin.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning flat pin row: %w", err)
		}
		pins = append(pins, pin)
	}
	return pins, rows.Err()
}

// CountActiveByUser returns the number of active flat pins for a user.
// Used to enforce the 5-pin cap.
func (r *FlatPinRepository) CountActiveByUser(ctx context.Context, userID string) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM flat_pins
		WHERE user_id = $1 AND status IN ('ACTIVE', 'RENEWED')
	`, userID).Scan(&count)
	return count, err
}
