package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"pune-flats/backend/internal/model"
)

// SeekerPinRepository handles seeker_pins CRUD and spatial queries.
type SeekerPinRepository struct {
	pool *pgxpool.Pool
}

// NewSeekerPinRepository creates a new SeekerPinRepository.
func NewSeekerPinRepository(pool *pgxpool.Pool) *SeekerPinRepository {
	return &SeekerPinRepository{pool: pool}
}

// Create inserts a new seeker pin and returns the created record.
func (r *SeekerPinRepository) Create(ctx context.Context, userID, cityID string, req *model.CreateSeekerPinRequest) (*model.SeekerPin, error) {
	var pin model.SeekerPin
	err := r.pool.QueryRow(ctx, `
		INSERT INTO seeker_pins (
			user_id, city_id, location,
			search_radius_km, budget_max, budget_min,
			bhk_configs, property_types, furnishing_min,
			preferred_move_in, notes
		) VALUES (
			$1, $2, ST_MakePoint($3, $4)::geography,
			$5, $6, $7,
			$8::bhk_config[], $9::property_type[], $10::furnishing_level,
			$11::date, $12
		)
		RETURNING id, user_id, city_id,
		          ST_Y(location::geometry), ST_X(location::geometry),
		          search_radius_km, budget_max, budget_min,
		          bhk_configs::text[], property_types::text[], furnishing_min::text,
		          preferred_move_in::text,
		          status::text, expires_at, notes, created_at, updated_at
	`,
		userID, cityID, req.Lng, req.Lat,
		req.SearchRadiusKM, req.BudgetMax, req.BudgetMin,
		req.BHKConfigs, req.PropertyTypes, req.FurnishingMin,
		req.PreferredMoveIn, req.Notes,
	).Scan(
		&pin.ID, &pin.UserID, &pin.CityID,
		&pin.Lat, &pin.Lng,
		&pin.SearchRadiusKM, &pin.BudgetMax, &pin.BudgetMin,
		&pin.BHKConfigs, &pin.PropertyTypes, &pin.FurnishingMin,
		&pin.PreferredMoveIn,
		&pin.Status, &pin.ExpiresAt, &pin.Notes, &pin.CreatedAt, &pin.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("inserting seeker pin: %w", err)
	}
	return &pin, nil
}

// GetByID returns a single seeker pin by ID.
func (r *SeekerPinRepository) GetByID(ctx context.Context, id string) (*model.SeekerPin, error) {
	var pin model.SeekerPin
	err := r.pool.QueryRow(ctx, `
		SELECT id, user_id, city_id,
		       ST_Y(location::geometry), ST_X(location::geometry),
		       search_radius_km, budget_max, budget_min,
		       bhk_configs::text[], property_types::text[], furnishing_min::text,
		       preferred_move_in::text,
		       status::text, expires_at, notes, created_at, updated_at
		FROM seeker_pins
		WHERE id = $1
	`, id).Scan(
		&pin.ID, &pin.UserID, &pin.CityID,
		&pin.Lat, &pin.Lng,
		&pin.SearchRadiusKM, &pin.BudgetMax, &pin.BudgetMin,
		&pin.BHKConfigs, &pin.PropertyTypes, &pin.FurnishingMin,
		&pin.PreferredMoveIn,
		&pin.Status, &pin.ExpiresAt, &pin.Notes, &pin.CreatedAt, &pin.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("fetching seeker pin %s: %w", id, err)
	}
	return &pin, nil
}

// ListInBBox returns seeker pins within the map viewport.
func (r *SeekerPinRepository) ListInBBox(ctx context.Context, cityID string, bbox model.BBox, p model.PaginationParams) ([]model.SeekerPin, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, city_id,
		       ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
		       search_radius_km, budget_max, budget_min,
		       bhk_configs::text[], property_types::text[], furnishing_min::text,
		       preferred_move_in::text,
		       status::text, expires_at, notes, created_at
		FROM seeker_pins
		WHERE city_id = $1
		  AND status IN ('ACTIVE', 'RENEWED')
		  AND location::geometry && ST_MakeEnvelope($2, $3, $4, $5, 4326)
		ORDER BY budget_max DESC
		LIMIT $6 OFFSET $7
	`, cityID, bbox.SWLng, bbox.SWLat, bbox.NELng, bbox.NELat, p.Limit, p.Offset)
	if err != nil {
		return nil, fmt.Errorf("listing seeker pins in bbox: %w", err)
	}
	defer rows.Close()

	var pins []model.SeekerPin
	for rows.Next() {
		var pin model.SeekerPin
		if err := rows.Scan(
			&pin.ID, &pin.CityID,
			&pin.Lat, &pin.Lng,
			&pin.SearchRadiusKM, &pin.BudgetMax, &pin.BudgetMin,
			&pin.BHKConfigs, &pin.PropertyTypes, &pin.FurnishingMin,
			&pin.PreferredMoveIn,
			&pin.Status, &pin.ExpiresAt, &pin.Notes, &pin.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning seeker pin row: %w", err)
		}
		pins = append(pins, pin)
	}
	return pins, rows.Err()
}

// CountActiveByUser returns the number of active seeker pins for a user.
// Used to enforce the 3-pin cap.
func (r *SeekerPinRepository) CountActiveByUser(ctx context.Context, userID string) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM seeker_pins
		WHERE user_id = $1 AND status IN ('ACTIVE', 'RENEWED')
	`, userID).Scan(&count)
	return count, err
}
