package handler

import (
	"net/http"

	"go.uber.org/zap"

	"pune-flats/backend/internal/middleware"
	"pune-flats/backend/internal/model"
	"pune-flats/backend/internal/repository"
)

// MatchHandler handles match-related API requests.
type MatchHandler struct {
	matchRepo *repository.MatchRepository
	logger    *zap.Logger
}

// NewMatchHandler creates a new MatchHandler.
func NewMatchHandler(matchRepo *repository.MatchRepository, logger *zap.Logger) *MatchHandler {
	return &MatchHandler{matchRepo: matchRepo, logger: logger}
}

// ListMyMatches handles GET /api/v1/matches
// Returns the authenticated user's matches sorted by OV score (highest first).
func (h *MatchHandler) ListMyMatches(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	pagination := ParsePagination(r)

	matches, err := h.matchRepo.ListMatchesByUser(r.Context(), userID, pagination)
	if err != nil {
		h.logger.Error("failed to list matches", zap.Error(err), zap.String("user_id", userID))
		Error(w, 500, "failed to list matches", "")
		return
	}

	if matches == nil {
		matches = []model.Match{}
	}

	// Mask user IDs from response
	for i := range matches {
		matches[i].SeekerUserID = ""
		matches[i].FlatUserID = ""
	}

	JSON(w, 200, matches, &model.Meta{
		Count:  len(matches),
		Limit:  pagination.Limit,
		Offset: pagination.Offset,
	})
}
