package model

import "time"

// OnboardingRequest represents payload submitted when a user completes onboarding.
type OnboardingRequest struct {
	UserID         string   `json:"user_id"`
	Goal           string   `json:"goal"` // "RENT", "FLATMATE", "BUY", "LIST"
	FirstName      string   `json:"first_name" validate:"required"`
	LastName       string   `json:"last_name"`
	DisplayName    string   `json:"display_name"`
	Phone          string   `json:"phone"`
	Occupation     string   `json:"occupation"`
	CitySlug       string   `json:"city_slug"`
	OfficeHub      string   `json:"office_hub"`   // "hinjewadi", "magarpatta", "kharadi", "baner"
	MetroLine      string   `json:"metro_line"`   // "LINE3", "AQUA", "PURPLE"
	BudgetMax      float64  `json:"budget_max"`
	CurrentRent    float64  `json:"current_rent"` // for baseline upgrade calculation
	Food           string   `json:"food"`         // "VEG", "NON_VEG", "EGGETARIAN", "VEGAN"
	Smoking        string   `json:"smoking"`      // "NO", "OCCASIONAL", "REGULAR"
	Pets           string   `json:"pets"`         // "NO_PETS", "PETS_WELCOME", "HAS_PETS"
	Gender         string   `json:"gender"`       // "MALE", "FEMALE", "ANY"
	SleepCycle     string   `json:"sleep_cycle"`  // "EARLY_BIRD", "NIGHT_OWL", "FLEXIBLE"
	Languages      []string `json:"languages"`
	Bio            string   `json:"bio"`
}

// UserProfileResponse returns comprehensive profile, baseline, and onboarding state.
type UserProfileResponse struct {
	ID             string    `json:"id"`
	Phone          string    `json:"phone"`
	FirstName      string    `json:"first_name"`
	LastName       string    `json:"last_name"`
	DisplayName    string    `json:"display_name"`
	CitySlug       string    `json:"city_slug"`
	Goal           string    `json:"goal"`
	Occupation     string    `json:"occupation"`
	OfficeHub      string    `json:"office_hub"`
	MetroLine      string    `json:"metro_line"`
	BudgetMax      float64   `json:"budget_max"`
	CurrentRent    float64   `json:"current_rent"`
	Food           string    `json:"food"`
	Smoking        string    `json:"smoking"`
	Pets           string    `json:"pets"`
	Gender         string    `json:"gender"`
	Bio            string    `json:"bio"`
	IsOnboarded    bool      `json:"is_onboarded"`
	CreatedAt      time.Time `json:"created_at"`
}
