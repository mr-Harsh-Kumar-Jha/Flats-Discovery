package handler

import (
	"net/http"

	"go.uber.org/zap"
	"pune-flats/backend/internal/middleware"
	"pune-flats/backend/internal/model"
	"pune-flats/backend/internal/repository"
)

// FlatmateHandler handles flatmate discovery and swipe interactions.
type FlatmateHandler struct {
	flatmateRepo *repository.FlatmateRepository
	chatRepo     *repository.ChatRepository
	logger       *zap.Logger
}

// NewFlatmateHandler creates a new FlatmateHandler.
func NewFlatmateHandler(
	flatmateRepo *repository.FlatmateRepository,
	chatRepo *repository.ChatRepository,
	logger *zap.Logger,
) *FlatmateHandler {
	return &FlatmateHandler{
		flatmateRepo: flatmateRepo,
		chatRepo:     chatRepo,
		logger:       logger,
	}
}

// ListCandidates returns a list of candidate flatmates for the swipe deck.
func (h *FlatmateHandler) ListCandidates(w http.ResponseWriter, r *http.Request) {
	citySlug := r.URL.Query().Get("city")
	if citySlug == "" {
		citySlug = "pune"
	}

	listingType := r.URL.Query().Get("type") // HAS_ROOM, SEEKING_PARTNER, or ALL
	food := r.URL.Query().Get("food")
	smoking := r.URL.Query().Get("smoking")
	gender := r.URL.Query().Get("gender")

	currentUserID := middleware.GetUserID(r.Context())

	candidates, err := h.flatmateRepo.ListCandidates(r.Context(), citySlug, currentUserID, listingType, food, smoking, gender)
	if err != nil {
		h.logger.Error("failed to list flatmate candidates", zap.Error(err))
		Error(w, http.StatusInternalServerError, "failed to fetch flatmates", err.Error())
		return
	}

	meta := &model.Meta{
		Count: len(candidates),
		Limit: 50,
	}

	JSON(w, http.StatusOK, candidates, meta)
}

// Swipe processes a user's swipe (LIKE, PASS, SUPERLIKE) on another flatmate.
func (h *FlatmateHandler) Swipe(w http.ResponseWriter, r *http.Request) {
	currentUserID := middleware.GetUserID(r.Context())
	if currentUserID == "" {
		Error(w, http.StatusUnauthorized, "authentication required", "")
		return
	}

	var req model.FlatmateSwipeRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}

	if req.TargetUserID == "" || req.SwipeType == "" {
		Error(w, http.StatusBadRequest, "target_user_id and swipe_type are required", "")
		return
	}

	isMatch, err := h.flatmateRepo.RecordSwipe(r.Context(), currentUserID, req.TargetUserID, req.SwipeType)
	if err != nil {
		h.logger.Error("failed to record swipe", zap.Error(err))
		Error(w, http.StatusInternalServerError, "failed to record swipe", err.Error())
		return
	}

	resp := model.FlatmateSwipeResponse{
		IsMatch: isMatch,
	}

	if isMatch {
		resp.Message = "It's a Match! You both liked each other."
		// Auto-create or fetch direct chat room
		room, err := h.chatRepo.CreateDirectRoom(r.Context(), currentUserID, model.CreateDirectRoomRequest{
			TargetUserID: req.TargetUserID,
		})
		if err == nil && room != nil {
			resp.MatchRoomID = &room.ID
		}
	} else if req.SwipeType == "PASS" {
		resp.Message = "Profile passed."
	} else {
		resp.Message = "Interest sent! If they like you back, it's a match."
	}

	JSON(w, http.StatusOK, resp, nil)
}
