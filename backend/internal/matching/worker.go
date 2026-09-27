package matching

import (
	"context"
	"fmt"
	"time"

	"go.uber.org/zap"

	"pune-flats/backend/internal/model"
	"pune-flats/backend/internal/repository"
)

// Worker is the background matchmaking worker.
// It polls the match_queue table for pending jobs and processes them.
type Worker struct {
	matchRepo    *repository.MatchRepository
	pollInterval time.Duration
	logger       *zap.Logger
}

// NewWorker creates a new matchmaking worker.
func NewWorker(matchRepo *repository.MatchRepository, pollInterval time.Duration, logger *zap.Logger) *Worker {
	return &Worker{
		matchRepo:    matchRepo,
		pollInterval: pollInterval,
		logger:       logger.Named("match-worker"),
	}
}

// Run starts the worker loop. It blocks until the context is cancelled.
// Call this in a goroutine from main.go.
func (w *Worker) Run(ctx context.Context) {
	w.logger.Info("matchmaking worker started",
		zap.Duration("poll_interval", w.pollInterval),
	)

	ticker := time.NewTicker(w.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			w.logger.Info("matchmaking worker shutting down")
			return
		case <-ticker.C:
			w.processNextJob(ctx)
		}
	}
}

// processNextJob picks and processes the next pending job from the queue.
func (w *Worker) processNextJob(ctx context.Context) {
	job, err := w.matchRepo.PickNextJob(ctx)
	if err != nil {
		w.logger.Error("failed to pick next job", zap.Error(err))
		return
	}
	if job == nil {
		return // No pending jobs — idle
	}

	w.logger.Info("processing match job",
		zap.String("job_id", job.ID),
		zap.String("trigger", job.TriggerType),
		zap.String("pin_id", job.PinID),
		zap.String("pin_table", job.PinTable),
		zap.Int("priority", job.Priority),
		zap.Int("retry", job.RetryCount),
	)

	start := time.Now()

	var matchCount int
	var processErr error

	switch job.PinTable {
	case "seeker_pins":
		matchCount, processErr = w.processNewSeekerPin(ctx, job)
	case "flat_pins":
		matchCount, processErr = w.processNewFlatPin(ctx, job)
	default:
		processErr = fmt.Errorf("unknown pin_table: %s", job.PinTable)
	}

	elapsed := time.Since(start)

	if processErr != nil {
		w.logger.Error("job processing failed",
			zap.String("job_id", job.ID),
			zap.Error(processErr),
			zap.Duration("elapsed", elapsed),
		)
		if err := w.matchRepo.FailJob(ctx, job.ID, processErr.Error()); err != nil {
			w.logger.Error("failed to mark job as failed", zap.Error(err))
		}
		return
	}

	if err := w.matchRepo.CompleteJob(ctx, job.ID); err != nil {
		w.logger.Error("failed to mark job as completed", zap.Error(err))
		return
	}

	w.logger.Info("job completed",
		zap.String("job_id", job.ID),
		zap.Int("matches_created", matchCount),
		zap.Duration("elapsed", elapsed),
	)
}

// processNewSeekerPin handles a new seeker pin:
// finds all flats in range → scores each → stores matches → queues notifications.
func (w *Worker) processNewSeekerPin(ctx context.Context, job *model.MatchQueueJob) (int, error) {
	// 1. Get the seeker pin details
	seekerPin, err := w.matchRepo.GetSeekerPinForScoring(ctx, job.PinID)
	if err != nil {
		return 0, fmt.Errorf("fetching seeker pin: %w", err)
	}

	// 2. Get user baseline (optional, for upgrade detection)
	baseline, err := w.matchRepo.GetUserBaseline(ctx, seekerPin.UserID)
	if err != nil {
		return 0, fmt.Errorf("fetching user baseline: %w", err)
	}

	// 3. Find all candidate flats within search radius
	candidates, err := w.matchRepo.FindCandidateFlats(ctx, job.PinID)
	if err != nil {
		return 0, fmt.Errorf("finding candidate flats: %w", err)
	}

	if len(candidates) == 0 {
		w.logger.Info("no candidates found for seeker pin",
			zap.String("pin_id", job.PinID),
		)
		return 0, nil
	}

	w.logger.Info("found candidate flats",
		zap.String("seeker_pin_id", job.PinID),
		zap.Int("count", len(candidates)),
	)

	// 4. Score each candidate
	matchCount := 0
	for _, candidate := range candidates {
		// Filter: BHK must match
		if !ContainsBHK(seekerPin.BHKConfigs, candidate.BHKConfig) {
			continue
		}

		// Filter: property type must match (if specified)
		if len(seekerPin.PropertyTypes) > 0 && !ContainsPropertyType(seekerPin.PropertyTypes, candidate.PropertyType) {
			continue
		}

		// Score the candidate
		result := CalculateOV(seekerPin, &candidate, baseline)

		// Only store matches with OV > 0.2 (skip very poor matches)
		if result.OpportunityValue < 0.2 {
			continue
		}

		// 5. Store the match
		match := &model.Match{
			SeekerPinID:         seekerPin.ID,
			FlatPinID:           candidate.FlatPinID,
			SeekerUserID:        seekerPin.UserID,
			FlatUserID:          candidate.FlatUserID,
			CityID:              job.CityID,
			OpportunityValue:    result.OpportunityValue,
			DistanceScore:       result.DistanceScore,
			BudgetScore:         result.BudgetScore,
			FurnishingScore:     result.FurnishingScore,
			TransitScore:        result.TransitScore,
			DistanceMeters:      candidate.DistanceMeters,
			IsFurnishingUpgrade: result.IsFurnishingUpgrade,
			IsCommuteUpgrade:    result.IsCommuteUpgrade,
			IsNetPositive:       result.IsNetPositive,
		}

		if err := w.matchRepo.InsertMatch(ctx, match); err != nil {
			w.logger.Error("failed to insert match",
				zap.String("seeker_pin_id", seekerPin.ID),
				zap.String("flat_pin_id", candidate.FlatPinID),
				zap.Error(err),
			)
			continue // Don't fail the entire job for one bad match
		}

		matchCount++

		// 6. Queue notification for the seeker
		if err := w.queueMatchNotification(ctx, seekerPin.UserID, seekerPin.ID, candidate.FlatPinID, result.OpportunityValue, job.Priority); err != nil {
			w.logger.Error("failed to queue notification", zap.Error(err))
			// Non-fatal: match is stored, notification can be retried
		}
	}

	return matchCount, nil
}

// processNewFlatPin handles a new flat pin:
// finds all seekers whose search radius includes this flat → re-scores.
func (w *Worker) processNewFlatPin(ctx context.Context, job *model.MatchQueueJob) (int, error) {
	// 1. Find all seekers whose search radius covers this flat
	seekers, err := w.matchRepo.FindCandidateSeekers(ctx, job.PinID)
	if err != nil {
		return 0, fmt.Errorf("finding candidate seekers: %w", err)
	}

	if len(seekers) == 0 {
		w.logger.Info("no seekers found for flat pin",
			zap.String("pin_id", job.PinID),
		)
		return 0, nil
	}

	w.logger.Info("found candidate seekers for new flat",
		zap.String("flat_pin_id", job.PinID),
		zap.Int("count", len(seekers)),
	)

	// 2. For each seeker, enqueue a match job (they will be scored individually)
	matchCount := 0
	for _, seeker := range seekers {
		// Instead of directly scoring here, we enqueue individual jobs
		// so each seeker gets scored with their own preferences.
		// This avoids duplicating the scoring logic.
		err := w.matchRepo.EnqueueJob(ctx,
			model.TriggerNewFlatPin,
			seeker.SeekerPinID,
			"seeker_pins",
			job.CityID,
			job.Priority,
		)
		if err != nil {
			w.logger.Error("failed to enqueue seeker re-score",
				zap.String("seeker_pin_id", seeker.SeekerPinID),
				zap.Error(err),
			)
			continue
		}
		matchCount++
	}

	return matchCount, nil
}

// queueMatchNotification creates a notification in the queue for match delivery.
// Premium users (priority >= 10) get INSTANT (WebSocket), others get BATCH (email digest).
func (w *Worker) queueMatchNotification(ctx context.Context, userID, seekerPinID, flatPinID string, ovScore float64, jobPriority int) error {
	matchID, err := w.matchRepo.GetMatchID(ctx, seekerPinID, flatPinID)
	if err != nil {
		return fmt.Errorf("getting match ID for notification: %w", err)
	}

	priority := model.NotifBatch
	channel := "email"
	if jobPriority >= 10 {
		priority = model.NotifInstant
		channel = "websocket"
	}

	payload := map[string]interface{}{
		"type":          "match_found",
		"match_id":      matchID,
		"ov_score":      ovScore,
		"seeker_pin_id": seekerPinID,
		"flat_pin_id":   flatPinID,
	}

	return w.matchRepo.InsertNotification(ctx, userID, matchID, channel, priority, payload)
}
