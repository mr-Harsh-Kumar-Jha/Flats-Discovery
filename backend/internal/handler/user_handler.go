package handler

import (
	"net/http"

	"go.uber.org/zap"
	"pune-flats/backend/internal/middleware"
	"pune-flats/backend/internal/model"
	"pune-flats/backend/internal/repository"
)

// UserHandler handles user onboarding and profile operations.
type UserHandler struct {
	userRepo *repository.UserRepository
	logger   *zap.Logger
}

// NewUserHandler creates a new UserHandler.
func NewUserHandler(userRepo *repository.UserRepository, logger *zap.Logger) *UserHandler {
	return &UserHandler{
		userRepo: userRepo,
		logger:   logger,
	}
}

// SaveOnboarding records user onboarding preferences.
func (h *UserHandler) SaveOnboarding(w http.ResponseWriter, r *http.Request) {
	currentUserID := middleware.GetUserID(r.Context())
	if currentUserID == "" {
		Error(w, http.StatusUnauthorized, "authentication required", "")
		return
	}

	var req model.OnboardingRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}

	profile, err := h.userRepo.SaveOnboarding(r.Context(), currentUserID, &req)
	if err != nil {
		h.logger.Error("failed to save onboarding", zap.Error(err))
		Error(w, http.StatusInternalServerError, "failed to save onboarding", err.Error())
		return
	}

	JSON(w, http.StatusOK, profile, nil)
}

// GetProfile returns the current authenticated user's profile and baseline.
func (h *UserHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	currentUserID := middleware.GetUserID(r.Context())
	if currentUserID == "" {
		Error(w, http.StatusUnauthorized, "authentication required", "")
		return
	}

	profile, err := h.userRepo.GetProfile(r.Context(), currentUserID)
	if err != nil {
		h.logger.Error("failed to get profile", zap.Error(err))
		Error(w, http.StatusInternalServerError, "failed to get profile", err.Error())
		return
	}

	JSON(w, http.StatusOK, profile, nil)
}
