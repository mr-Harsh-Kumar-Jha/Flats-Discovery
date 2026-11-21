package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"pune-flats/backend/internal/model"
)

// UserRepository handles user onboarding, profile, and baseline data.
type UserRepository struct {
	pool *pgxpool.Pool
}

// NewUserRepository creates a new UserRepository.
func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

// SaveOnboarding persists user onboarding selections across users, user_baselines, and flatmate_profiles.
func (r *UserRepository) SaveOnboarding(ctx context.Context, userID string, req *model.OnboardingRequest) (*model.UserProfileResponse, error) {
	if req.DisplayName == "" {
		if req.LastName != "" {
			req.DisplayName = fmt.Sprintf("%s %s.", req.FirstName, string([]rune(req.LastName)[0]))
		} else {
			req.DisplayName = req.FirstName
		}
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Update user identity
	_, err = tx.Exec(ctx, `
		UPDATE users
		SET first_name = COALESCE(NULLIF($1, ''), first_name),
		    last_name = COALESCE(NULLIF($2, ''), last_name),
		    display_name = COALESCE(NULLIF($3, ''), display_name),
		    updated_at = NOW()
		WHERE id = $4
	`, req.FirstName, req.LastName, req.DisplayName, userID)
	if err != nil {
		return nil, fmt.Errorf("updating user: %w", err)
	}

	// 2. Resolve office commute coordinates
	var officeLng, officeLat float64 = 73.8567, 18.5204
	switch req.OfficeHub {
	case "hinjewadi":
		officeLng, officeLat = 73.7389, 18.5913
	case "magarpatta":
		officeLng, officeLat = 73.9298, 18.5146
	case "kharadi":
		officeLng, officeLat = 73.9532, 18.5514
	case "baner":
		officeLng, officeLat = 73.7868, 18.5590
	}

	currentRent := req.CurrentRent
	if currentRent <= 0 {
		currentRent = 15000 // default baseline
	}

	// 3. Upsert user_baselines for the lifestyle upgrade engine
	_, err = tx.Exec(ctx, `
		INSERT INTO user_baselines (
			user_id, current_rent, current_furnishing, current_bhk,
			commute_destination, commute_destination_name, current_commute_km
		) VALUES (
			$1, $2, 'SEMI_FURNISHED', '2BHK',
			ST_MakePoint($3, $4)::geography, $5, 12.0
		)
		ON CONFLICT (user_id) DO UPDATE SET
			current_rent = EXCLUDED.current_rent,
			commute_destination = EXCLUDED.commute_destination,
			commute_destination_name = EXCLUDED.commute_destination_name,
			updated_at = NOW()
	`, userID, currentRent, officeLng, officeLat, req.OfficeHub)
	if err != nil {
		return nil, fmt.Errorf("upserting user_baseline: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("committing onboarding transaction: %w", err)
	}

	return &model.UserProfileResponse{
		ID:          userID,
		FirstName:   req.FirstName,
		LastName:    req.LastName,
		DisplayName: req.DisplayName,
		Goal:        req.Goal,
		Occupation:  req.Occupation,
		OfficeHub:   req.OfficeHub,
		MetroLine:   req.MetroLine,
		BudgetMax:   req.BudgetMax,
		CurrentRent: currentRent,
		Food:        req.Food,
		Smoking:     req.Smoking,
		Pets:        req.Pets,
		Gender:      req.Gender,
		Bio:         req.Bio,
		IsOnboarded: true,
	}, nil
}

// GetProfile retrieves user profile and baseline state.
func (r *UserRepository) GetProfile(ctx context.Context, userID string) (*model.UserProfileResponse, error) {
	var resp model.UserProfileResponse
	resp.ID = userID

	err := r.pool.QueryRow(ctx, `
		SELECT u.first_name, u.last_name, u.display_name, u.phone,
		       COALESCE(b.current_rent, 15000), COALESCE(b.commute_destination_name, 'hinjewadi')
		FROM users u
		LEFT JOIN user_baselines b ON b.user_id = u.id
		WHERE u.id = $1
	`, userID).Scan(
		&resp.FirstName, &resp.LastName, &resp.DisplayName, &resp.Phone,
		&resp.CurrentRent, &resp.OfficeHub,
	)
	if err != nil {
		return nil, fmt.Errorf("fetching profile for %s: %w", userID, err)
	}

	resp.IsOnboarded = true
	return &resp, nil
}
