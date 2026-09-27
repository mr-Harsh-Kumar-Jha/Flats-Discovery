// Package model defines shared types used across the application.
package model

import "time"

// -------------------------------------------------------------------------
// API Response Envelope
// -------------------------------------------------------------------------

// APIResponse wraps all API responses in a consistent envelope.
type APIResponse struct {
	Data interface{} `json:"data,omitempty"`
	Meta *Meta       `json:"meta,omitempty"`
	Error *APIError  `json:"error,omitempty"`
}

// Meta holds pagination and query metadata.
type Meta struct {
	Count  int       `json:"count"`
	Limit  int       `json:"limit,omitempty"`
	Offset int       `json:"offset,omitempty"`
	BBox   []float64 `json:"bbox,omitempty"` // [sw_lng, sw_lat, ne_lng, ne_lat]
}

// APIError represents a structured error response.
type APIError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

// -------------------------------------------------------------------------
// Pagination
// -------------------------------------------------------------------------

// PaginationParams holds limit/offset extracted from query params.
type PaginationParams struct {
	Limit  int
	Offset int
}

// DefaultPagination returns safe defaults (limit 50, offset 0).
func DefaultPagination() PaginationParams {
	return PaginationParams{Limit: 50, Offset: 0}
}

// -------------------------------------------------------------------------
// Bounding Box
// -------------------------------------------------------------------------

// BBox represents a map viewport bounding box.
type BBox struct {
	SWLng float64 `json:"sw_lng"` // Southwest longitude
	SWLat float64 `json:"sw_lat"` // Southwest latitude
	NELng float64 `json:"ne_lng"` // Northeast longitude
	NELat float64 `json:"ne_lat"` // Northeast latitude
}

// IsValid checks that the bounding box has non-zero area and valid coords.
func (b BBox) IsValid() bool {
	if b.SWLng >= b.NELng || b.SWLat >= b.NELat {
		return false
	}
	if b.SWLat < -90 || b.SWLat > 90 || b.NELat < -90 || b.NELat > 90 {
		return false
	}
	if b.SWLng < -180 || b.SWLng > 180 || b.NELng < -180 || b.NELng > 180 {
		return false
	}
	return true
}

// ApproxAreaKM2 estimates the bounding box area in square kilometers.
// Uses a rough approximation suitable for Indian latitudes (18-28°N).
func (b BBox) ApproxAreaKM2() float64 {
	// 1 degree latitude ≈ 111 km
	// 1 degree longitude ≈ 111 * cos(lat) km
	avgLat := (b.SWLat + b.NELat) / 2.0
	latKM := (b.NELat - b.SWLat) * 111.0

	// cos approximation for radians
	cosLat := 1.0 - (avgLat*avgLat*3.14159*3.14159)/(2.0*180.0*180.0)
	lngKM := (b.NELng - b.SWLng) * 111.0 * cosLat

	return latKM * lngKM
}

// ToSlice returns the bbox as [sw_lng, sw_lat, ne_lng, ne_lat].
func (b BBox) ToSlice() []float64 {
	return []float64{b.SWLng, b.SWLat, b.NELng, b.NELat}
}

// -------------------------------------------------------------------------
// Enums as Go constants
// -------------------------------------------------------------------------

// Pin statuses
const (
	PinStatusActive   = "ACTIVE"
	PinStatusExpired  = "EXPIRED"
	PinStatusResolved = "RESOLVED"
	PinStatusRenewed  = "RENEWED"
)

// Auth statuses
const (
	AuthUnverified       = "UNVERIFIED"
	AuthOTPVerified      = "OTP_VERIFIED"
	AuthCommunityVerified = "COMMUNITY_VERIFIED"
)

// Property types
var ValidPropertyTypes = []string{
	"APARTMENT", "INDEPENDENT_HOUSE", "PG", "CO_LIVING",
}

// BHK configs
var ValidBHKConfigs = []string{
	"1RK", "1BHK", "2BHK", "3BHK", "4BHK", "4PLUS_BHK", "STUDIO", "SINGLE_ROOM",
}

// Furnishing levels (ordered by quality for >= comparison)
var FurnishingLevels = []string{
	"UNFURNISHED", "SEMI_FURNISHED", "FULLY_FURNISHED", "LUXURY_FURNISHED",
}

// -------------------------------------------------------------------------
// Timestamp helpers
// -------------------------------------------------------------------------

// TimePtr returns a pointer to a time.Time (used for nullable fields).
func TimePtr(t time.Time) *time.Time {
	return &t
}
