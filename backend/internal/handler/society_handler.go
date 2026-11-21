package handler

import (
	"net/http"
	"strconv"

	"go.uber.org/zap"
	"pune-flats/backend/internal/model"
	"pune-flats/backend/internal/repository"
)

// SocietyHandler handles housing societies listing and details.
type SocietyHandler struct {
	societyRepo *repository.SocietyRepository
	logger      *zap.Logger
}

// NewSocietyHandler creates a new SocietyHandler.
func NewSocietyHandler(societyRepo *repository.SocietyRepository, logger *zap.Logger) *SocietyHandler {
	return &SocietyHandler{
		societyRepo: societyRepo,
		logger:      logger,
	}
}

// ListSocieties returns a list of housing societies matching criteria.
func (h *SocietyHandler) ListSocieties(w http.ResponseWriter, r *http.Request) {
	citySlug := r.URL.Query().Get("city")
	if citySlug == "" {
		citySlug = "pune"
	}

	metroLine := r.URL.Query().Get("metro")
	minBedroom := r.URL.Query().Get("bedroom")

	var minSqft int
	if s := r.URL.Query().Get("sqft"); s != "" {
		minSqft, _ = strconv.Atoi(s)
	}

	var maxRent float64
	if s := r.URL.Query().Get("max_rent"); s != "" {
		maxRent, _ = strconv.ParseFloat(s, 64)
	}

	societies, err := h.societyRepo.List(r.Context(), citySlug, metroLine, minBedroom, minSqft, maxRent)
	if err != nil {
		h.logger.Error("failed to list societies", zap.Error(err))
		Error(w, http.StatusInternalServerError, "failed to fetch societies", err.Error())
		return
	}

	meta := &model.Meta{
		Count: len(societies),
		Limit: 50,
	}

	JSON(w, http.StatusOK, societies, meta)
}
