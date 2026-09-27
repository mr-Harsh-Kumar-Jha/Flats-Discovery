package model

import "time"

// -------------------------------------------------------------------------
// City
// -------------------------------------------------------------------------

// City represents a supported city with feature flag.
type City struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Slug       string    `json:"slug"`
	State      string    `json:"state"`
	CenterLat  float64   `json:"center_lat"`
	CenterLng  float64   `json:"center_lng"`
	DefaultZoom int      `json:"default_zoom"`
	IsActive   bool      `json:"is_active"`
	CreatedAt  time.Time `json:"created_at"`
}
