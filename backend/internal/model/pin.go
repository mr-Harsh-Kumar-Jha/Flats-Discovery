package model

import "time"

// =========================================================================
// Flat Pin
// =========================================================================

// FlatPin represents an available flat listing on the map.
type FlatPin struct {
	ID            string     `json:"id"`
	UserID        string     `json:"user_id,omitempty"` // Omitted in public responses
	CityID        string     `json:"city_id"`
	Lat           float64    `json:"lat"`
	Lng           float64    `json:"lng"`
	Rent          float64    `json:"rent"`
	DepositAmount *float64   `json:"deposit_amount,omitempty"`
	BHKConfig     string     `json:"bhk_config"`
	PropertyType  string     `json:"property_type"`
	Furnishing    string     `json:"furnishing"`
	LeaseDuration *string    `json:"lease_duration,omitempty"`
	AvailableFrom *string    `json:"available_from,omitempty"` // date string YYYY-MM-DD
	FloorNumber   *int       `json:"floor_number,omitempty"`
	TotalFloors   *int       `json:"total_floors,omitempty"`
	Parking       string     `json:"parking"`
	WaterSupply   string     `json:"water_supply"`
	PowerBackup   string     `json:"power_backup"`
	Status        string     `json:"status"`
	ExpiresAt     time.Time  `json:"expires_at"`
	Description   *string    `json:"description,omitempty"`
	ImageURLs     []string   `json:"image_urls,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// CreateFlatPinRequest is the payload for creating a new flat pin.
type CreateFlatPinRequest struct {
	Lat           float64  `json:"lat" validate:"required"`
	Lng           float64  `json:"lng" validate:"required"`
	CitySlug      string   `json:"city" validate:"required"`
	Rent          float64  `json:"rent" validate:"required,gt=0"`
	DepositAmount *float64 `json:"deposit_amount"`
	BHKConfig     string   `json:"bhk_config" validate:"required"`
	PropertyType  string   `json:"property_type" validate:"required"`
	Furnishing    string   `json:"furnishing" validate:"required"`
	LeaseDuration *string  `json:"lease_duration"`
	AvailableFrom *string  `json:"available_from"`
	FloorNumber   *int     `json:"floor_number"`
	TotalFloors   *int     `json:"total_floors"`
	Parking       string   `json:"parking"`
	WaterSupply   string   `json:"water_supply"`
	PowerBackup   string   `json:"power_backup"`
	Description   *string  `json:"description"`
}

// Validate checks the request fields against allowed enum values.
func (r *CreateFlatPinRequest) Validate() *APIError {
	if r.Lat < -90 || r.Lat > 90 || r.Lng < -180 || r.Lng > 180 {
		return &APIError{Code: 400, Message: "invalid coordinates"}
	}
	if r.Rent <= 0 {
		return &APIError{Code: 400, Message: "rent must be greater than 0"}
	}
	if !contains(ValidBHKConfigs, r.BHKConfig) {
		return &APIError{Code: 400, Message: "invalid bhk_config", Details: "allowed: 1RK, 1BHK, 2BHK, 3BHK, 4BHK, 4PLUS_BHK, STUDIO, SINGLE_ROOM"}
	}
	if !contains(ValidPropertyTypes, r.PropertyType) {
		return &APIError{Code: 400, Message: "invalid property_type", Details: "allowed: APARTMENT, INDEPENDENT_HOUSE, PG, CO_LIVING"}
	}
	if !contains(FurnishingLevels, r.Furnishing) {
		return &APIError{Code: 400, Message: "invalid furnishing", Details: "allowed: UNFURNISHED, SEMI_FURNISHED, FULLY_FURNISHED, LUXURY_FURNISHED"}
	}
	// Apply defaults for optional enums
	if r.Parking == "" {
		r.Parking = "NONE"
	}
	if r.WaterSupply == "" {
		r.WaterSupply = "MUNICIPAL"
	}
	if r.PowerBackup == "" {
		r.PowerBackup = "NONE"
	}
	return nil
}

// =========================================================================
// Seeker Pin
// =========================================================================

// SeekerPin represents a seeker's desired location on the map.
type SeekerPin struct {
	ID             string    `json:"id"`
	UserID         string    `json:"user_id,omitempty"`
	CityID         string    `json:"city_id"`
	Lat            float64   `json:"lat"`
	Lng            float64   `json:"lng"`
	SearchRadiusKM float64   `json:"search_radius_km"`
	BudgetMax      float64   `json:"budget_max"`
	BudgetMin      *float64  `json:"budget_min,omitempty"`
	BHKConfigs     []string  `json:"bhk_configs"`
	PropertyTypes  []string  `json:"property_types"`
	FurnishingMin  string    `json:"furnishing_min"`
	PreferredMoveIn *string  `json:"preferred_move_in,omitempty"`
	Status         string    `json:"status"`
	ExpiresAt      time.Time `json:"expires_at"`
	Notes          *string   `json:"notes,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// CreateSeekerPinRequest is the payload for creating a new seeker pin.
type CreateSeekerPinRequest struct {
	Lat             float64  `json:"lat" validate:"required"`
	Lng             float64  `json:"lng" validate:"required"`
	CitySlug        string   `json:"city" validate:"required"`
	SearchRadiusKM  float64  `json:"search_radius_km" validate:"required,gt=0,lte=25"`
	BudgetMax       float64  `json:"budget_max" validate:"required,gt=0"`
	BudgetMin       *float64 `json:"budget_min"`
	BHKConfigs      []string `json:"bhk_configs" validate:"required,min=1"`
	PropertyTypes   []string `json:"property_types"`
	FurnishingMin   string   `json:"furnishing_min"`
	PreferredMoveIn *string  `json:"preferred_move_in"`
	Notes           *string  `json:"notes"`
}

// Validate checks the seeker pin request.
func (r *CreateSeekerPinRequest) Validate() *APIError {
	if r.Lat < -90 || r.Lat > 90 || r.Lng < -180 || r.Lng > 180 {
		return &APIError{Code: 400, Message: "invalid coordinates"}
	}
	if r.SearchRadiusKM <= 0 || r.SearchRadiusKM > 25 {
		return &APIError{Code: 400, Message: "search_radius_km must be between 0 and 25"}
	}
	if r.BudgetMax <= 0 {
		return &APIError{Code: 400, Message: "budget_max must be greater than 0"}
	}
	if r.BudgetMin != nil && *r.BudgetMin > r.BudgetMax {
		return &APIError{Code: 400, Message: "budget_min cannot exceed budget_max"}
	}
	if len(r.BHKConfigs) == 0 {
		return &APIError{Code: 400, Message: "at least one bhk_config is required"}
	}
	for _, bhk := range r.BHKConfigs {
		if !contains(ValidBHKConfigs, bhk) {
			return &APIError{Code: 400, Message: "invalid bhk_config: " + bhk}
		}
	}
	// Defaults
	if len(r.PropertyTypes) == 0 {
		r.PropertyTypes = []string{"APARTMENT"}
	}
	if r.FurnishingMin == "" {
		r.FurnishingMin = "UNFURNISHED"
	}
	return nil
}

// =========================================================================
// Rent Heatmap Pin
// =========================================================================

// HeatmapPin represents an anonymous rent data point.
type HeatmapPin struct {
	ID           string  `json:"id"`
	Lat          float64 `json:"lat"`
	Lng          float64 `json:"lng"`
	Rent         float64 `json:"rent"`
	BHKConfig    string  `json:"bhk_config"`
	PropertyType string  `json:"property_type"`
	Source       string  `json:"source"`
	ReportedAt   string  `json:"reported_at"` // date YYYY-MM-DD
}

// HeatmapAggregate represents an aggregated heatmap grid cell.
type HeatmapAggregate struct {
	Lat         float64 `json:"lat"`
	Lng         float64 `json:"lng"`
	AvgRent     float64 `json:"avg_rent"`
	SampleCount int     `json:"sample_count"`
	DominantBHK string  `json:"dominant_bhk"`
}

// CreateHeatmapRequest is the payload for self-reporting rent.
type CreateHeatmapRequest struct {
	Lat          float64 `json:"lat" validate:"required"`
	Lng          float64 `json:"lng" validate:"required"`
	CitySlug     string  `json:"city" validate:"required"`
	Rent         float64 `json:"rent" validate:"required,gt=0"`
	BHKConfig    string  `json:"bhk_config" validate:"required"`
	PropertyType string  `json:"property_type"`
}

// Validate checks the heatmap report request.
func (r *CreateHeatmapRequest) Validate() *APIError {
	if r.Lat < -90 || r.Lat > 90 || r.Lng < -180 || r.Lng > 180 {
		return &APIError{Code: 400, Message: "invalid coordinates"}
	}
	if r.Rent <= 0 {
		return &APIError{Code: 400, Message: "rent must be greater than 0"}
	}
	if !contains(ValidBHKConfigs, r.BHKConfig) {
		return &APIError{Code: 400, Message: "invalid bhk_config"}
	}
	if r.PropertyType == "" {
		r.PropertyType = "APARTMENT"
	}
	return nil
}

// =========================================================================
// To-Let Board
// =========================================================================

// ToLetBoard represents a crowdsourced to-let sign photo.
type ToLetBoard struct {
	ID               string  `json:"id"`
	UploadedBy       string  `json:"uploaded_by,omitempty"`
	CityID           string  `json:"city_id"`
	Lat              float64 `json:"lat"`
	Lng              float64 `json:"lng"`
	ImageURL         string  `json:"image_url"`           // Scrubbed or placeholder URL
	ScrubStatus      string  `json:"scrub_status"`
	TranscribedPhone *string `json:"transcribed_phone,omitempty"`
	TranscribedText  *string `json:"transcribed_text,omitempty"`
	Description      *string `json:"description,omitempty"`
	CreatedAt        string  `json:"created_at"`
}

// CreateToLetRequest is the payload for uploading a to-let board.
type CreateToLetRequest struct {
	Lat         float64 `json:"lat" validate:"required"`
	Lng         float64 `json:"lng" validate:"required"`
	CitySlug    string  `json:"city" validate:"required"`
	ImageKey    string  `json:"image_key" validate:"required"` // S3 key after client upload
	Description *string `json:"description"`
}

// Validate checks the to-let board request.
func (r *CreateToLetRequest) Validate() *APIError {
	if r.Lat < -90 || r.Lat > 90 || r.Lng < -180 || r.Lng > 180 {
		return &APIError{Code: 400, Message: "invalid coordinates"}
	}
	if r.ImageKey == "" {
		return &APIError{Code: 400, Message: "image_key is required"}
	}
	return nil
}

// =========================================================================
// Polygon Search
// =========================================================================

// PolygonSearchRequest is the payload for drawing a polygon on the map.
type PolygonSearchRequest struct {
	CitySlug string      `json:"city" validate:"required"`
	PinType  string      `json:"pin_type" validate:"required"` // "flats", "seekers", "heatmap", "tolet"
	GeoJSON  interface{} `json:"geojson" validate:"required"`  // GeoJSON Polygon object
}

// =========================================================================
// Helpers
// =========================================================================

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
