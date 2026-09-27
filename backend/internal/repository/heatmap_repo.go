package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"pune-flats/backend/internal/model"
)

// HeatmapRepository handles rent_heatmap_pins queries.
type HeatmapRepository struct {
	pool *pgxpool.Pool
}

// NewHeatmapRepository creates a new HeatmapRepository.
func NewHeatmapRepository(pool *pgxpool.Pool) *HeatmapRepository {
	return &HeatmapRepository{pool: pool}
}

// CreateSelfReported inserts a self-reported rent data point.
func (r *HeatmapRepository) CreateSelfReported(ctx context.Context, userID, cityID string, req *model.CreateHeatmapRequest) (*model.HeatmapPin, error) {
	var pin model.HeatmapPin
	err := r.pool.QueryRow(ctx, `
		INSERT INTO rent_heatmap_pins (
			user_id, city_id, location, rent, bhk_config, property_type, source
		) VALUES (
			$1, $2, ST_MakePoint($3, $4)::geography,
			$5, $6::bhk_config, $7::property_type, 'SELF_REPORTED'::heatmap_source
		)
		RETURNING id,
		          ST_Y(location::geometry), ST_X(location::geometry),
		          rent, bhk_config::text, property_type::text, source::text, reported_at::text
	`, userID, cityID, req.Lng, req.Lat, req.Rent, req.BHKConfig, req.PropertyType,
	).Scan(
		&pin.ID, &pin.Lat, &pin.Lng,
		&pin.Rent, &pin.BHKConfig, &pin.PropertyType, &pin.Source, &pin.ReportedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("inserting heatmap pin: %w", err)
	}
	return &pin, nil
}

// ListInBBox returns individual heatmap data points in the viewport.
// Used for zoomed-in views where individual points are visible.
func (r *HeatmapRepository) ListInBBox(ctx context.Context, cityID string, bbox model.BBox, p model.PaginationParams) ([]model.HeatmapPin, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id,
		       ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
		       rent, bhk_config::text, property_type::text, source::text, reported_at::text
		FROM rent_heatmap_pins
		WHERE city_id = $1
		  AND location::geometry && ST_MakeEnvelope($2, $3, $4, $5, 4326)
		  AND reported_at >= CURRENT_DATE - INTERVAL '6 months'
		ORDER BY reported_at DESC
		LIMIT $6 OFFSET $7
	`, cityID, bbox.SWLng, bbox.SWLat, bbox.NELng, bbox.NELat, p.Limit, p.Offset)
	if err != nil {
		return nil, fmt.Errorf("listing heatmap pins in bbox: %w", err)
	}
	defer rows.Close()

	var pins []model.HeatmapPin
	for rows.Next() {
		var pin model.HeatmapPin
		if err := rows.Scan(
			&pin.ID, &pin.Lat, &pin.Lng,
			&pin.Rent, &pin.BHKConfig, &pin.PropertyType, &pin.Source, &pin.ReportedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning heatmap pin row: %w", err)
		}
		pins = append(pins, pin)
	}
	return pins, rows.Err()
}

// AggregateInBBox returns rent data aggregated into grid cells.
// Used for the heatmap layer at wider zoom levels.
// Grid size is ~500m (0.005 degrees).
func (r *HeatmapRepository) AggregateInBBox(ctx context.Context, cityID string, bbox model.BBox) ([]model.HeatmapAggregate, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT
		    ST_Y(ST_SnapToGrid(location::geometry, 0.005)) AS lat,
		    ST_X(ST_SnapToGrid(location::geometry, 0.005)) AS lng,
		    AVG(rent) AS avg_rent,
		    COUNT(*) AS sample_count,
		    mode() WITHIN GROUP (ORDER BY bhk_config::text) AS dominant_bhk
		FROM rent_heatmap_pins
		WHERE city_id = $1
		  AND location::geometry && ST_MakeEnvelope($2, $3, $4, $5, 4326)
		  AND reported_at >= CURRENT_DATE - INTERVAL '6 months'
		GROUP BY ST_SnapToGrid(location::geometry, 0.005)
		HAVING COUNT(*) >= 2
		ORDER BY avg_rent DESC
	`, cityID, bbox.SWLng, bbox.SWLat, bbox.NELng, bbox.NELat)
	if err != nil {
		return nil, fmt.Errorf("aggregating heatmap in bbox: %w", err)
	}
	defer rows.Close()

	var aggs []model.HeatmapAggregate
	for rows.Next() {
		var a model.HeatmapAggregate
		if err := rows.Scan(&a.Lat, &a.Lng, &a.AvgRent, &a.SampleCount, &a.DominantBHK); err != nil {
			return nil, fmt.Errorf("scanning heatmap aggregate: %w", err)
		}
		aggs = append(aggs, a)
	}
	return aggs, rows.Err()
}
