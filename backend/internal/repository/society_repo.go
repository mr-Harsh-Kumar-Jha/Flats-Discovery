package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"pune-flats/backend/internal/model"
)

// SocietyRepository handles housing_societies queries.
type SocietyRepository struct {
	pool *pgxpool.Pool
}

// NewSocietyRepository creates a new SocietyRepository.
func NewSocietyRepository(pool *pgxpool.Pool) *SocietyRepository {
	return &SocietyRepository{pool: pool}
}

// List returns societies matching city and filter constraints.
func (r *SocietyRepository) List(
	ctx context.Context,
	citySlug string,
	metroLine string,
	minBedroom string,
	minSqft int,
	maxRent float64,
) ([]model.HousingSociety, error) {
	query := `
		SELECT
			s.id, s.city_id, s.name, s.slug, s.locality,
			ST_Y(s.location::geometry) as lat, ST_X(s.location::geometry) as lng,
			COALESCE(s.towers_count, 4), COALESCE(s.units_count, 250),
			COALESCE(s.min_rent, 0), COALESCE(s.max_rent, 0), COALESCE(s.min_price, 0), COALESCE(s.max_price, 0),
			COALESCE(s.avg_price_per_sqft, 0), COALESCE(s.rental_yield_pct, 0), COALESCE(s.price_to_rent_ratio, 0),
			COALESCE(s.nearest_metro_station, ''), COALESCE(s.metro_distance_meters, 0), COALESCE(s.metro_line, ''),
			COALESCE(s.office_commute, '{}'::jsonb), COALESCE(s.amenities, ARRAY[]::text[]),
			COALESCE(s.min_bedroom_dims, '11x12'), COALESCE(s.min_sqft, 600), COALESCE(s.max_sqft, 2500),
			COALESCE(s.rera_id, ''), COALESCE(s.verified_source, 'RERA Verified'), COALESCE(s.rating, 4.5), COALESCE(s.description, ''),
			s.osm_id, COALESCE(s.available_sales_count, 0), COALESCE(s.available_rentals_count, 0),
			COALESCE(s.last_synced_at, now()), s.created_at, s.updated_at
		FROM housing_societies s
		JOIN cities c ON c.id = s.city_id
		WHERE c.slug = $1
	`
	args := []interface{}{citySlug}
	argIdx := 2

	if metroLine != "" && metroLine != "ALL" {
		query += fmt.Sprintf(" AND s.metro_line = $%d", argIdx)
		args = append(args, metroLine)
		argIdx++
	}

	if maxRent > 0 {
		query += fmt.Sprintf(" AND s.min_rent <= $%d", argIdx)
		args = append(args, maxRent)
		argIdx++
	}

	if minSqft > 0 {
		query += fmt.Sprintf(" AND s.max_sqft >= $%d", argIdx)
		args = append(args, minSqft)
		argIdx++
	}

	query += " ORDER BY s.rating DESC, s.name ASC"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("querying societies: %w", err)
	}
	defer rows.Close()

	var societies []model.HousingSociety
	for rows.Next() {
		var s model.HousingSociety
		var officeCommuteJSON []byte

		err := rows.Scan(
			&s.ID, &s.CityID, &s.Name, &s.Slug, &s.Locality,
			&s.Lat, &s.Lng,
			&s.TowersCount, &s.UnitsCount,
			&s.MinRent, &s.MaxRent, &s.MinPrice, &s.MaxPrice,
			&s.AvgPricePerSqft, &s.RentalYieldPct, &s.PriceToRentRatio,
			&s.NearestMetroStation, &s.MetroDistanceMeters, &s.MetroLine,
			&officeCommuteJSON, &s.Amenities,
			&s.MinBedroomDims, &s.MinSqft, &s.MaxSqft,
			&s.ReraID, &s.VerifiedSource, &s.Rating, &s.Description,
			&s.OSMID, &s.AvailableSalesCount, &s.AvailableRentalsCount,
			&s.LastSyncedAt, &s.CreatedAt, &s.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scanning society: %w", err)
		}

		if len(officeCommuteJSON) > 0 {
			_ = json.Unmarshal(officeCommuteJSON, &s.OfficeCommute)
		}

		societies = append(societies, s)
	}

	return societies, nil
}
