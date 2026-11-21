package model

import "time"

// HousingSociety represents a residential project / society (flat-finder style).
type HousingSociety struct {
	ID                    string                 `json:"id"`
	CityID                string                 `json:"city_id"`
	Name                  string                 `json:"name"`
	Slug                  string                 `json:"slug"`
	Locality              string                 `json:"locality"`
	Lat                   float64                `json:"lat"`
	Lng                   float64                `json:"lng"`
	TowersCount           int                    `json:"towers_count"`
	UnitsCount            int                    `json:"units_count"`
	MinRent               float64                `json:"min_rent"`
	MaxRent               float64                `json:"max_rent"`
	MinPrice              float64                `json:"min_price"` // Buy price INR
	MaxPrice              float64                `json:"max_price"`
	AvgPricePerSqft       float64                `json:"avg_price_per_sqft"`
	RentalYieldPct        float64                `json:"rental_yield_pct"`
	PriceToRentRatio      float64                `json:"price_to_rent_ratio"`
	NearestMetroStation   string                 `json:"nearest_metro_station"`
	MetroDistanceMeters   int                    `json:"metro_distance_meters"`
	MetroLine             string                 `json:"metro_line"`
	OfficeCommute         map[string]interface{} `json:"office_commute,omitempty"`
	Amenities             []string               `json:"amenities"`
	MinBedroomDims        string                 `json:"min_bedroom_dims"` // e.g. "11x12"
	MinSqft               int                    `json:"min_sqft"`
	MaxSqft               int                    `json:"max_sqft"`
	ReraID                string                 `json:"rera_id"`
	VerifiedSource        string                 `json:"verified_source"`
	Rating                float64                `json:"rating"`
	Description           string                 `json:"description"`
	OSMID                 *int64                 `json:"osm_id,omitempty"`
	AvailableSalesCount   int                    `json:"available_sales_count"`
	AvailableRentalsCount int                    `json:"available_rentals_count"`
	LastSyncedAt          time.Time              `json:"last_synced_at"`
	CreatedAt             time.Time              `json:"created_at"`
	UpdatedAt             time.Time              `json:"updated_at"`
}
