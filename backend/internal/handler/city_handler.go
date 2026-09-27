package handler

import (
	"net/http"

	"go.uber.org/zap"

	"pune-flats/backend/internal/model"
	"pune-flats/backend/internal/repository"
)

// CityHandler handles city-related API requests.
type CityHandler struct {
	cityRepo *repository.CityRepository
	logger   *zap.Logger
}

// NewCityHandler creates a new CityHandler.
func NewCityHandler(cityRepo *repository.CityRepository, logger *zap.Logger) *CityHandler {
	return &CityHandler{cityRepo: cityRepo, logger: logger}
}

// ListActive returns all active cities with their map center points.
// GET /api/v1/cities
func (h *CityHandler) ListActive(w http.ResponseWriter, r *http.Request) {
	cities, err := h.cityRepo.ListActive(r.Context())
	if err != nil {
		h.logger.Error("failed to list cities", zap.Error(err))
		Error(w, 500, "failed to list cities", "")
		return
	}

	if cities == nil {
		cities = []model.City{}
	}

	JSON(w, 200, cities, &model.Meta{Count: len(cities)})
}
