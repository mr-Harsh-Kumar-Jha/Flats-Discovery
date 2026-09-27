package model

import "time"

// =========================================================================
// Match Queue — Job queue for the background worker
// =========================================================================

// MatchQueueJob represents a pending matchmaking job.
type MatchQueueJob struct {
	ID           string     `json:"id"`
	TriggerType  string     `json:"trigger_type"`  // "new_seeker_pin", "new_flat_pin", "pin_updated"
	PinID        string     `json:"pin_id"`
	PinTable     string     `json:"pin_table"`     // "seeker_pins" or "flat_pins"
	CityID       string     `json:"city_id"`
	Priority     int        `json:"priority"`      // Higher = process first (premium = 10)
	Status       string     `json:"status"`        // PENDING, PROCESSING, COMPLETED, FAILED
	RetryCount   int        `json:"retry_count"`
	MaxRetries   int        `json:"max_retries"`
	ErrorMessage *string    `json:"error_message,omitempty"`
	StartedAt    *time.Time `json:"started_at,omitempty"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
}

// Queue job trigger types
const (
	TriggerNewSeekerPin = "new_seeker_pin"
	TriggerNewFlatPin   = "new_flat_pin"
	TriggerPinUpdated   = "pin_updated"
)

// Queue job statuses
const (
	QueuePending    = "PENDING"
	QueueProcessing = "PROCESSING"
	QueueCompleted  = "COMPLETED"
	QueueFailed     = "FAILED"
)

// =========================================================================
// Match — Output of the matchmaking engine
// =========================================================================

// Match represents a scored match between a seeker and a flat pin.
type Match struct {
	ID              string  `json:"id"`
	SeekerPinID     string  `json:"seeker_pin_id"`
	FlatPinID       string  `json:"flat_pin_id"`
	SeekerUserID    string  `json:"seeker_user_id,omitempty"`
	FlatUserID      string  `json:"flat_user_id,omitempty"`
	CityID          string  `json:"city_id"`

	// Opportunity Value (composite score)
	OpportunityValue float64 `json:"opportunity_value"`

	// Score components (0.0 to 1.0 each)
	DistanceScore    float64  `json:"distance_score"`
	BudgetScore      float64  `json:"budget_score"`
	FurnishingScore  float64  `json:"furnishing_score"`
	TransitScore     *float64 `json:"transit_score,omitempty"`

	// Computed distances
	DistanceMeters   float64  `json:"distance_meters"`
	CommuteDeltaKM   *float64 `json:"commute_delta_km,omitempty"`

	// Upgrade flags
	IsFurnishingUpgrade bool `json:"is_furnishing_upgrade"`
	IsCommuteUpgrade    bool `json:"is_commute_upgrade"`
	IsNetPositive       bool `json:"is_net_positive"`

	// Status
	Status          string     `json:"status"` // PENDING, VIEWED, CONTACTED, REJECTED, EXPIRED
	ViewedAt        *time.Time `json:"viewed_at,omitempty"`
	ChatInitiatedAt *time.Time `json:"chat_initiated_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

// MatchCandidate is a flat pin with pre-computed distance, used during scoring.
type MatchCandidate struct {
	FlatPinID     string
	FlatUserID    string
	Rent          float64
	BHKConfig     string
	PropertyType  string
	Furnishing    string
	Parking       string
	WaterSupply   string
	PowerBackup   string
	DistanceMeters float64
}

// =========================================================================
// Notification Queue
// =========================================================================

// Notification represents an outbound notification for a match result.
type Notification struct {
	ID           string `json:"id"`
	UserID       string `json:"user_id"`
	MatchID      string `json:"match_id"`
	Channel      string `json:"channel"`  // "websocket", "email", "push"
	Priority     string `json:"priority"` // "INSTANT" or "BATCH"
	Payload      string `json:"payload"`  // JSON string
	Status       string `json:"status"`   // PENDING, SENT, FAILED, SKIPPED
}

// NotificationPriority
const (
	NotifInstant = "INSTANT" // Premium users: real-time WebSocket push
	NotifBatch   = "BATCH"   // Free users: aggregated hourly digest
)
