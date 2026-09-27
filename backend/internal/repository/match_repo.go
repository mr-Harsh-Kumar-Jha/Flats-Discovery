package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"pune-flats/backend/internal/model"
)

// MatchRepository handles match queue, matches, and notifications.
type MatchRepository struct {
	pool *pgxpool.Pool
}

// NewMatchRepository creates a new MatchRepository.
func NewMatchRepository(pool *pgxpool.Pool) *MatchRepository {
	return &MatchRepository{pool: pool}
}

// =========================================================================
// Match Queue Operations
// =========================================================================

// EnqueueJob inserts a new matchmaking job into the queue.
func (r *MatchRepository) EnqueueJob(ctx context.Context, triggerType, pinID, pinTable, cityID string, priority int) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO match_queue (trigger_type, pin_id, pin_table, city_id, priority)
		VALUES ($1, $2, $3, $4, $5)
	`, triggerType, pinID, pinTable, cityID, priority)
	if err != nil {
		return fmt.Errorf("enqueuing match job: %w", err)
	}
	return nil
}

// PickNextJob atomically picks the next pending job from the queue.
// Uses FOR UPDATE SKIP LOCKED for safe concurrent worker processing.
// Returns nil if no jobs are available.
func (r *MatchRepository) PickNextJob(ctx context.Context) (*model.MatchQueueJob, error) {
	var job model.MatchQueueJob
	err := r.pool.QueryRow(ctx, `
		UPDATE match_queue
		SET status = 'PROCESSING', started_at = NOW()
		WHERE id = (
			SELECT id FROM match_queue
			WHERE status = 'PENDING'
			ORDER BY priority DESC, created_at ASC
			LIMIT 1
			FOR UPDATE SKIP LOCKED
		)
		RETURNING id, trigger_type, pin_id, pin_table, city_id, priority,
		          status, retry_count, max_retries, error_message,
		          started_at, completed_at, created_at
	`).Scan(
		&job.ID, &job.TriggerType, &job.PinID, &job.PinTable, &job.CityID, &job.Priority,
		&job.Status, &job.RetryCount, &job.MaxRetries, &job.ErrorMessage,
		&job.StartedAt, &job.CompletedAt, &job.CreatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil // No jobs available
		}
		return nil, fmt.Errorf("picking next job: %w", err)
	}
	return &job, nil
}

// CompleteJob marks a job as completed.
func (r *MatchRepository) CompleteJob(ctx context.Context, jobID string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE match_queue
		SET status = 'COMPLETED', completed_at = NOW()
		WHERE id = $1
	`, jobID)
	return err
}

// FailJob marks a job as failed and increments the retry count.
// If retries are exhausted, it stays in FAILED state.
// Otherwise, it's reset to PENDING for retry.
func (r *MatchRepository) FailJob(ctx context.Context, jobID string, errMsg string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE match_queue
		SET
			status = CASE
				WHEN retry_count + 1 >= max_retries THEN 'FAILED'
				ELSE 'PENDING'
			END,
			retry_count = retry_count + 1,
			error_message = $2,
			started_at = NULL
		WHERE id = $1
	`, jobID, errMsg)
	return err
}

// =========================================================================
// Match Candidate Queries — Used by the scoring engine
// =========================================================================

// FindCandidateFlats returns all active flat pins within the seeker's search radius.
// Uses ST_DWithin for indexed spatial lookups.
func (r *MatchRepository) FindCandidateFlats(ctx context.Context, seekerPinID string) ([]model.MatchCandidate, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT
		    fp.id AS flat_pin_id,
		    fp.user_id AS flat_user_id,
		    fp.rent,
		    fp.bhk_config::text,
		    fp.property_type::text,
		    fp.furnishing::text,
		    fp.parking::text,
		    fp.water_supply::text,
		    fp.power_backup::text,
		    ST_Distance(fp.location, sp.location) AS distance_meters
		FROM flat_pins fp
		CROSS JOIN seeker_pins sp
		WHERE sp.id = $1
		  AND fp.city_id = sp.city_id
		  AND fp.status IN ('ACTIVE', 'RENEWED')
		  AND fp.user_id != sp.user_id                     -- Don't match with own pins
		  AND ST_DWithin(fp.location, sp.location, sp.search_radius_km * 1000)
		ORDER BY ST_Distance(fp.location, sp.location) ASC
	`, seekerPinID)
	if err != nil {
		return nil, fmt.Errorf("finding candidate flats: %w", err)
	}
	defer rows.Close()

	var candidates []model.MatchCandidate
	for rows.Next() {
		var c model.MatchCandidate
		if err := rows.Scan(
			&c.FlatPinID, &c.FlatUserID,
			&c.Rent, &c.BHKConfig, &c.PropertyType, &c.Furnishing,
			&c.Parking, &c.WaterSupply, &c.PowerBackup,
			&c.DistanceMeters,
		); err != nil {
			return nil, fmt.Errorf("scanning candidate flat: %w", err)
		}
		candidates = append(candidates, c)
	}
	return candidates, rows.Err()
}

// FindCandidateSeekers returns all active seeker pins whose search radius
// includes the given flat pin's location.
// Used when a new flat pin is created to find matching seekers.
func (r *MatchRepository) FindCandidateSeekers(ctx context.Context, flatPinID string) ([]struct {
	SeekerPinID  string
	SeekerUserID string
}, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT sp.id, sp.user_id
		FROM seeker_pins sp
		CROSS JOIN flat_pins fp
		WHERE fp.id = $1
		  AND sp.city_id = fp.city_id
		  AND sp.status IN ('ACTIVE', 'RENEWED')
		  AND sp.user_id != fp.user_id
		  AND ST_DWithin(fp.location, sp.location, sp.search_radius_km * 1000)
	`, flatPinID)
	if err != nil {
		return nil, fmt.Errorf("finding candidate seekers: %w", err)
	}
	defer rows.Close()

	var result []struct {
		SeekerPinID  string
		SeekerUserID string
	}
	for rows.Next() {
		var s struct {
			SeekerPinID  string
			SeekerUserID string
		}
		if err := rows.Scan(&s.SeekerPinID, &s.SeekerUserID); err != nil {
			return nil, err
		}
		result = append(result, s)
	}
	return result, rows.Err()
}

// GetSeekerPinForScoring returns the seeker pin data needed by the OV scorer.
func (r *MatchRepository) GetSeekerPinForScoring(ctx context.Context, seekerPinID string) (*model.SeekerPin, error) {
	var pin model.SeekerPin
	err := r.pool.QueryRow(ctx, `
		SELECT id, user_id, city_id,
		       ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
		       search_radius_km, budget_max, budget_min,
		       bhk_configs::text[], property_types::text[], furnishing_min::text,
		       status, expires_at, created_at, updated_at
		FROM seeker_pins
		WHERE id = $1
	`, seekerPinID).Scan(
		&pin.ID, &pin.UserID, &pin.CityID,
		&pin.Lat, &pin.Lng,
		&pin.SearchRadiusKM, &pin.BudgetMax, &pin.BudgetMin,
		&pin.BHKConfigs, &pin.PropertyTypes, &pin.FurnishingMin,
		&pin.Status, &pin.ExpiresAt, &pin.CreatedAt, &pin.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("fetching seeker pin for scoring: %w", err)
	}
	return &pin, nil
}

// GetUserBaseline returns the user's current living baseline (if set).
// Used for the Lifestyle Upgrade Engine component of OV scoring.
func (r *MatchRepository) GetUserBaseline(ctx context.Context, userID string) (*UserBaseline, error) {
	var b UserBaseline
	err := r.pool.QueryRow(ctx, `
		SELECT id, user_id,
		       current_rent, current_furnishing::text, current_bhk::text, current_property_type::text,
		       commute_destination_name, current_commute_km,
		       current_parking::text, current_water_supply::text, current_power_backup::text
		FROM user_baselines
		WHERE user_id = $1
	`, userID).Scan(
		&b.ID, &b.UserID,
		&b.CurrentRent, &b.CurrentFurnishing, &b.CurrentBHK, &b.CurrentPropertyType,
		&b.CommuteDestinationName, &b.CurrentCommuteKM,
		&b.CurrentParking, &b.CurrentWaterSupply, &b.CurrentPowerBackup,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil // No baseline set
		}
		return nil, fmt.Errorf("fetching user baseline: %w", err)
	}
	return &b, nil
}

// UserBaseline holds the user's current living situation for upgrade comparison.
type UserBaseline struct {
	ID                     string   `json:"id"`
	UserID                 string   `json:"user_id"`
	CurrentRent            float64  `json:"current_rent"`
	CurrentFurnishing      string   `json:"current_furnishing"`
	CurrentBHK             string   `json:"current_bhk"`
	CurrentPropertyType    string   `json:"current_property_type"`
	CommuteDestinationName *string  `json:"commute_destination_name,omitempty"`
	CurrentCommuteKM       *float64 `json:"current_commute_km,omitempty"`
	CurrentParking         string   `json:"current_parking"`
	CurrentWaterSupply     string   `json:"current_water_supply"`
	CurrentPowerBackup     string   `json:"current_power_backup"`
}

// =========================================================================
// Match Storage
// =========================================================================

// InsertMatch stores a scored match. Uses ON CONFLICT to update
// if the same seeker-flat pair already exists (e.g., from a re-run).
func (r *MatchRepository) InsertMatch(ctx context.Context, m *model.Match) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO matches (
			seeker_pin_id, flat_pin_id, seeker_user_id, flat_user_id, city_id,
			opportunity_value, distance_score, budget_score, furnishing_score, transit_score,
			distance_meters, commute_delta_km,
			is_furnishing_upgrade, is_commute_upgrade, is_net_positive
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10,
			$11, $12,
			$13, $14, $15
		)
		ON CONFLICT (seeker_pin_id, flat_pin_id) DO UPDATE SET
			opportunity_value     = EXCLUDED.opportunity_value,
			distance_score        = EXCLUDED.distance_score,
			budget_score          = EXCLUDED.budget_score,
			furnishing_score      = EXCLUDED.furnishing_score,
			transit_score         = EXCLUDED.transit_score,
			distance_meters       = EXCLUDED.distance_meters,
			commute_delta_km      = EXCLUDED.commute_delta_km,
			is_furnishing_upgrade = EXCLUDED.is_furnishing_upgrade,
			is_commute_upgrade    = EXCLUDED.is_commute_upgrade,
			is_net_positive       = EXCLUDED.is_net_positive,
			updated_at            = NOW()
	`,
		m.SeekerPinID, m.FlatPinID, m.SeekerUserID, m.FlatUserID, m.CityID,
		m.OpportunityValue, m.DistanceScore, m.BudgetScore, m.FurnishingScore, m.TransitScore,
		m.DistanceMeters, m.CommuteDeltaKM,
		m.IsFurnishingUpgrade, m.IsCommuteUpgrade, m.IsNetPositive,
	)
	if err != nil {
		return fmt.Errorf("inserting match: %w", err)
	}
	return nil
}

// GetMatchID returns the match UUID for a seeker-flat pair (used for notification FK).
func (r *MatchRepository) GetMatchID(ctx context.Context, seekerPinID, flatPinID string) (string, error) {
	var id string
	err := r.pool.QueryRow(ctx, `
		SELECT id FROM matches
		WHERE seeker_pin_id = $1 AND flat_pin_id = $2
	`, seekerPinID, flatPinID).Scan(&id)
	return id, err
}

// ListMatchesByUser returns matches for a given user (as seeker), ordered by OV score.
func (r *MatchRepository) ListMatchesByUser(ctx context.Context, userID string, p model.PaginationParams) ([]model.Match, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, seeker_pin_id, flat_pin_id, seeker_user_id, flat_user_id, city_id,
		       opportunity_value, distance_score, budget_score, furnishing_score, transit_score,
		       distance_meters, commute_delta_km,
		       is_furnishing_upgrade, is_commute_upgrade, is_net_positive,
		       status, viewed_at, chat_initiated_at, created_at
		FROM matches
		WHERE seeker_user_id = $1
		  AND status IN ('PENDING', 'VIEWED')
		ORDER BY opportunity_value DESC
		LIMIT $2 OFFSET $3
	`, userID, p.Limit, p.Offset)
	if err != nil {
		return nil, fmt.Errorf("listing matches: %w", err)
	}
	defer rows.Close()

	var matches []model.Match
	for rows.Next() {
		var m model.Match
		if err := rows.Scan(
			&m.ID, &m.SeekerPinID, &m.FlatPinID, &m.SeekerUserID, &m.FlatUserID, &m.CityID,
			&m.OpportunityValue, &m.DistanceScore, &m.BudgetScore, &m.FurnishingScore, &m.TransitScore,
			&m.DistanceMeters, &m.CommuteDeltaKM,
			&m.IsFurnishingUpgrade, &m.IsCommuteUpgrade, &m.IsNetPositive,
			&m.Status, &m.ViewedAt, &m.ChatInitiatedAt, &m.CreatedAt,
		); err != nil {
			return nil, err
		}
		matches = append(matches, m)
	}
	return matches, rows.Err()
}

// =========================================================================
// Notification Queue
// =========================================================================

// InsertNotification queues a match notification for delivery.
func (r *MatchRepository) InsertNotification(ctx context.Context, userID, matchID, channel, priority string, payload map[string]interface{}) error {
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshaling notification payload: %w", err)
	}

	_, err = r.pool.Exec(ctx, `
		INSERT INTO notification_queue (user_id, match_id, channel, priority, payload)
		VALUES ($1, $2, $3, $4, $5)
	`, userID, matchID, channel, priority, payloadJSON)
	if err != nil {
		return fmt.Errorf("inserting notification: %w", err)
	}
	return nil
}
