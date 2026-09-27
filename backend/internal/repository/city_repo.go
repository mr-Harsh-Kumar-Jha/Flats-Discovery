// Package repository contains all database query logic.
// Each repository is a thin wrapper around pgxpool.Pool
// with typed methods that return model structs.
package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"pune-flats/backend/internal/model"
)

// CityRepository handles city lookups.
type CityRepository struct {
	pool *pgxpool.Pool
}

// NewCityRepository creates a new CityRepository.
func NewCityRepository(pool *pgxpool.Pool) *CityRepository {
	return &CityRepository{pool: pool}
}

// ListActive returns all cities where is_active = true.
func (r *CityRepository) ListActive(ctx context.Context) ([]model.City, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, name, slug, state,
		       ST_Y(center_point::geometry) AS center_lat,
		       ST_X(center_point::geometry) AS center_lng,
		       default_zoom, is_active, created_at
		FROM cities
		WHERE is_active = true
		ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cities []model.City
	for rows.Next() {
		var c model.City
		if err := rows.Scan(
			&c.ID, &c.Name, &c.Slug, &c.State,
			&c.CenterLat, &c.CenterLng,
			&c.DefaultZoom, &c.IsActive, &c.CreatedAt,
		); err != nil {
			return nil, err
		}
		cities = append(cities, c)
	}
	return cities, rows.Err()
}

// GetBySlug returns a city by its URL-friendly slug.
func (r *CityRepository) GetBySlug(ctx context.Context, slug string) (*model.City, error) {
	var c model.City
	err := r.pool.QueryRow(ctx, `
		SELECT id, name, slug, state,
		       ST_Y(center_point::geometry) AS center_lat,
		       ST_X(center_point::geometry) AS center_lng,
		       default_zoom, is_active, created_at
		FROM cities
		WHERE slug = $1
	`, slug).Scan(
		&c.ID, &c.Name, &c.Slug, &c.State,
		&c.CenterLat, &c.CenterLng,
		&c.DefaultZoom, &c.IsActive, &c.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// GetIDBySlug returns just the city UUID for a given slug.
// Used internally by other repositories to resolve city references.
func (r *CityRepository) GetIDBySlug(ctx context.Context, slug string) (string, error) {
	var id string
	err := r.pool.QueryRow(ctx,
		`SELECT id FROM cities WHERE slug = $1 AND is_active = true`, slug,
	).Scan(&id)
	return id, err
}
