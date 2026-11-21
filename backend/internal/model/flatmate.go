package model

import "time"

// FlatmateProfile represents a user's flatmate preference profile.
type FlatmateProfile struct {
	ID               string    `json:"id"`
	UserID           string    `json:"user_id"`
	CityID           string    `json:"city_id"`
	ListingType      string    `json:"listing_type"` // HAS_ROOM or SEEKING_PARTNER
	FlatPinID        *string   `json:"flat_pin_id,omitempty"`
	SeekerPinID      *string   `json:"seeker_pin_id,omitempty"`
	Food             string    `json:"food"`
	Smoking          string    `json:"smoking"`
	Pets             string    `json:"pets"`
	Gender           string    `json:"gender"`
	AgeMin           *int      `json:"age_min,omitempty"`
	AgeMax           *int      `json:"age_max,omitempty"`
	Occupation       *string   `json:"occupation,omitempty"`
	Languages        []string  `json:"languages,omitempty"`
	RoomRent         *float64  `json:"room_rent,omitempty"`
	RoomsAvailable   *int      `json:"rooms_available,omitempty"`
	CurrentOccupants *int      `json:"current_occupants,omitempty"`
	IsActive         bool      `json:"is_active"`
	Bio              *string   `json:"bio,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`

	// Enriched fields for Tinder-style card deck presentation
	UserName         string    `json:"user_name,omitempty"`
	UserAvatar       string    `json:"user_avatar,omitempty"`
	Lat              *float64  `json:"lat,omitempty"`
	Lng              *float64  `json:"lng,omitempty"`
	LocalityName     string    `json:"locality_name,omitempty"`
	SocietyName      string    `json:"society_name,omitempty"`
	BHKConfig        string    `json:"bhk_config,omitempty"`
	NearMetroLine    string    `json:"near_metro_line,omitempty"`
	MetroDistMeters  *int      `json:"metro_dist_meters,omitempty"`
	CommuteOffice    string    `json:"commute_office,omitempty"`
	CommuteMins      *int      `json:"commute_mins,omitempty"`
	Compatibility    int       `json:"compatibility_score,omitempty"` // 0 - 100%
}

// FlatmateSwipeRequest records a user's swipe on another flatmate profile.
type FlatmateSwipeRequest struct {
	TargetUserID string `json:"target_user_id" validate:"required"`
	SwipeType    string `json:"swipe_type" validate:"required"` // LIKE, PASS, SUPERLIKE
}

// FlatmateSwipeResponse reports swipe result and mutual match status.
type FlatmateSwipeResponse struct {
	IsMatch     bool    `json:"is_match"`
	MatchRoomID *string `json:"match_room_id,omitempty"`
	Message     string  `json:"message"`
}
