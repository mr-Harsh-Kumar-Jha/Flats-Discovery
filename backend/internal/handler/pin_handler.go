package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"go.uber.org/zap"

	"pune-flats/backend/internal/middleware"
	"pune-flats/backend/internal/model"
	"pune-flats/backend/internal/repository"
)

// PinHandler handles all pin-related API requests.
type PinHandler struct {
	flatRepo    *repository.FlatPinRepository
	seekerRepo  *repository.SeekerPinRepository
	heatmapRepo *repository.HeatmapRepository
	toletRepo   *repository.ToLetRepository
	cityRepo    *repository.CityRepository
	matchRepo   *repository.MatchRepository
	logger      *zap.Logger
}

// NewPinHandler creates a new PinHandler.
func NewPinHandler(
	flatRepo *repository.FlatPinRepository,
	seekerRepo *repository.SeekerPinRepository,
	heatmapRepo *repository.HeatmapRepository,
	toletRepo *repository.ToLetRepository,
	cityRepo *repository.CityRepository,
	matchRepo *repository.MatchRepository,
	logger *zap.Logger,
) *PinHandler {
	return &PinHandler{
		flatRepo:    flatRepo,
		seekerRepo:  seekerRepo,
		heatmapRepo: heatmapRepo,
		toletRepo:   toletRepo,
		cityRepo:    cityRepo,
		matchRepo:   matchRepo,
		logger:      logger,
	}
}

// =========================================================================
// Flat Pins
// =========================================================================

// CreateFlatPin handles POST /api/v1/pins/flats
func (h *PinHandler) CreateFlatPin(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var req model.CreateFlatPinRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, 400, "invalid request body", err.Error())
		return
	}

	if apiErr := req.Validate(); apiErr != nil {
		ErrorFromModel(w, apiErr)
		return
	}

	// Resolve city
	cityID, err := h.cityRepo.GetIDBySlug(r.Context(), req.CitySlug)
	if err != nil {
		Error(w, 400, "invalid city", "city not found or not active: "+req.CitySlug)
		return
	}

	// Enforce pin cap (max 5 active flat pins per user)
	count, err := h.flatRepo.CountActiveByUser(r.Context(), userID)
	if err != nil {
		h.logger.Error("failed to count active flat pins", zap.Error(err))
		Error(w, 500, "internal error", "")
		return
	}
	if count >= 5 {
		Error(w, 429, "flat pin limit reached", "maximum 5 active flat pins per user")
		return
	}

	pin, err := h.flatRepo.Create(r.Context(), userID, cityID, &req)
	if err != nil {
		h.logger.Error("failed to create flat pin", zap.Error(err))
		Error(w, 500, "failed to create flat pin", "")
		return
	}

	// Clear the user_id from the response (identity masking)
	pin.UserID = ""

	h.logger.Info("flat pin created",
		zap.String("pin_id", pin.ID),
		zap.String("user_id", userID),
		zap.Float64("rent", pin.Rent),
	)

	// Enqueue match job asynchronously (fire-and-forget)
	if err := h.matchRepo.EnqueueJob(r.Context(), model.TriggerNewFlatPin, pin.ID, "flat_pins", cityID, 0); err != nil {
		h.logger.Error("failed to enqueue flat pin match job", zap.Error(err))
		// Non-fatal: pin is created, matching will be retried
	}

	JSON(w, 201, pin, nil)
}

// ListFlatPins handles GET /api/v1/pins/flats?city=pune&sw_lng=...&sw_lat=...&ne_lng=...&ne_lat=...
func (h *PinHandler) ListFlatPins(w http.ResponseWriter, r *http.Request) {
	citySlug := r.URL.Query().Get("city")
	if citySlug == "" {
		Error(w, 400, "city parameter is required", "")
		return
	}

	cityID, err := h.cityRepo.GetIDBySlug(r.Context(), citySlug)
	if err != nil {
		Error(w, 400, "invalid city: "+citySlug, "")
		return
	}

	bbox, apiErr := ParseBBox(r)
	if apiErr != nil {
		ErrorFromModel(w, apiErr)
		return
	}

	pagination := ParsePagination(r)

	pins, err := h.flatRepo.ListInBBox(r.Context(), cityID, *bbox, pagination)
	if err != nil {
		h.logger.Error("failed to list flat pins", zap.Error(err))
		Error(w, 500, "failed to list flat pins", "")
		return
	}

	if pins == nil {
		pins = []model.FlatPin{}
	}

	JSON(w, 200, pins, &model.Meta{
		Count:  len(pins),
		Limit:  pagination.Limit,
		Offset: pagination.Offset,
		BBox:   bbox.ToSlice(),
	})
}

// GetFlatPin handles GET /api/v1/pins/flats/{id}
func (h *PinHandler) GetFlatPin(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		Error(w, 400, "pin id is required", "")
		return
	}

	pin, err := h.flatRepo.GetByID(r.Context(), id)
	if err != nil {
		Error(w, 404, "flat pin not found", "")
		return
	}

	// Identity masking: clear user_id from public response
	pin.UserID = ""

	JSON(w, 200, pin, nil)
}

// =========================================================================
// Seeker Pins
// =========================================================================

// CreateSeekerPin handles POST /api/v1/pins/seekers
func (h *PinHandler) CreateSeekerPin(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var req model.CreateSeekerPinRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, 400, "invalid request body", err.Error())
		return
	}

	if apiErr := req.Validate(); apiErr != nil {
		ErrorFromModel(w, apiErr)
		return
	}

	cityID, err := h.cityRepo.GetIDBySlug(r.Context(), req.CitySlug)
	if err != nil {
		Error(w, 400, "invalid city: "+req.CitySlug, "")
		return
	}

	// Enforce pin cap (max 3 active seeker pins per user)
	count, err := h.seekerRepo.CountActiveByUser(r.Context(), userID)
	if err != nil {
		h.logger.Error("failed to count active seeker pins", zap.Error(err))
		Error(w, 500, "internal error", "")
		return
	}
	if count >= 3 {
		Error(w, 429, "seeker pin limit reached", "maximum 3 active seeker pins per user")
		return
	}

	pin, err := h.seekerRepo.Create(r.Context(), userID, cityID, &req)
	if err != nil {
		h.logger.Error("failed to create seeker pin", zap.Error(err))
		Error(w, 500, "failed to create seeker pin", "")
		return
	}

	pin.UserID = ""

	h.logger.Info("seeker pin created",
		zap.String("pin_id", pin.ID),
		zap.String("user_id", userID),
		zap.Float64("budget_max", pin.BudgetMax),
	)

	// Enqueue match job asynchronously (fire-and-forget)
	if err := h.matchRepo.EnqueueJob(r.Context(), model.TriggerNewSeekerPin, pin.ID, "seeker_pins", cityID, 0); err != nil {
		h.logger.Error("failed to enqueue seeker pin match job", zap.Error(err))
		// Non-fatal: pin is created, matching will be retried
	}

	JSON(w, 201, pin, nil)
}

// ListSeekerPins handles GET /api/v1/pins/seekers?city=pune&sw_lng=...&sw_lat=...&ne_lng=...&ne_lat=...
func (h *PinHandler) ListSeekerPins(w http.ResponseWriter, r *http.Request) {
	citySlug := r.URL.Query().Get("city")
	if citySlug == "" {
		Error(w, 400, "city parameter is required", "")
		return
	}

	cityID, err := h.cityRepo.GetIDBySlug(r.Context(), citySlug)
	if err != nil {
		Error(w, 400, "invalid city: "+citySlug, "")
		return
	}

	bbox, apiErr := ParseBBox(r)
	if apiErr != nil {
		ErrorFromModel(w, apiErr)
		return
	}

	pagination := ParsePagination(r)

	pins, err := h.seekerRepo.ListInBBox(r.Context(), cityID, *bbox, pagination)
	if err != nil {
		h.logger.Error("failed to list seeker pins", zap.Error(err))
		Error(w, 500, "failed to list seeker pins", "")
		return
	}

	if pins == nil {
		pins = []model.SeekerPin{}
	}

	JSON(w, 200, pins, &model.Meta{
		Count:  len(pins),
		Limit:  pagination.Limit,
		Offset: pagination.Offset,
		BBox:   bbox.ToSlice(),
	})
}

// GetSeekerPin handles GET /api/v1/pins/seekers/{id}
func (h *PinHandler) GetSeekerPin(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		Error(w, 400, "pin id is required", "")
		return
	}

	pin, err := h.seekerRepo.GetByID(r.Context(), id)
	if err != nil {
		Error(w, 404, "seeker pin not found", "")
		return
	}

	pin.UserID = ""
	JSON(w, 200, pin, nil)
}

// =========================================================================
// Heatmap
// =========================================================================

// CreateHeatmapPin handles POST /api/v1/pins/heatmap
func (h *PinHandler) CreateHeatmapPin(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var req model.CreateHeatmapRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, 400, "invalid request body", err.Error())
		return
	}

	if apiErr := req.Validate(); apiErr != nil {
		ErrorFromModel(w, apiErr)
		return
	}

	cityID, err := h.cityRepo.GetIDBySlug(r.Context(), req.CitySlug)
	if err != nil {
		Error(w, 400, "invalid city: "+req.CitySlug, "")
		return
	}

	pin, err := h.heatmapRepo.CreateSelfReported(r.Context(), userID, cityID, &req)
	if err != nil {
		h.logger.Error("failed to create heatmap pin", zap.Error(err))
		Error(w, 500, "failed to create heatmap pin", "")
		return
	}

	JSON(w, 201, pin, nil)
}

// ListHeatmap handles GET /api/v1/pins/heatmap?city=pune&sw_lng=...&mode=aggregate|points
func (h *PinHandler) ListHeatmap(w http.ResponseWriter, r *http.Request) {
	citySlug := r.URL.Query().Get("city")
	if citySlug == "" {
		Error(w, 400, "city parameter is required", "")
		return
	}

	cityID, err := h.cityRepo.GetIDBySlug(r.Context(), citySlug)
	if err != nil {
		Error(w, 400, "invalid city: "+citySlug, "")
		return
	}

	bbox, apiErr := ParseBBox(r)
	if apiErr != nil {
		ErrorFromModel(w, apiErr)
		return
	}

	mode := r.URL.Query().Get("mode")
	if mode == "" {
		mode = "aggregate"
	}

	if mode == "aggregate" {
		aggs, err := h.heatmapRepo.AggregateInBBox(r.Context(), cityID, *bbox)
		if err != nil {
			h.logger.Error("failed to aggregate heatmap", zap.Error(err))
			Error(w, 500, "failed to aggregate heatmap", "")
			return
		}
		if aggs == nil {
			aggs = []model.HeatmapAggregate{}
		}
		JSON(w, 200, aggs, &model.Meta{Count: len(aggs), BBox: bbox.ToSlice()})
	} else {
		pagination := ParsePagination(r)
		pins, err := h.heatmapRepo.ListInBBox(r.Context(), cityID, *bbox, pagination)
		if err != nil {
			h.logger.Error("failed to list heatmap pins", zap.Error(err))
			Error(w, 500, "failed to list heatmap pins", "")
			return
		}
		if pins == nil {
			pins = []model.HeatmapPin{}
		}
		JSON(w, 200, pins, &model.Meta{
			Count:  len(pins),
			Limit:  pagination.Limit,
			Offset: pagination.Offset,
			BBox:   bbox.ToSlice(),
		})
	}
}

// =========================================================================
// To-Let Boards
// =========================================================================

// CreateToLetBoard handles POST /api/v1/pins/tolet
func (h *PinHandler) CreateToLetBoard(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var req model.CreateToLetRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, 400, "invalid request body", err.Error())
		return
	}

	if apiErr := req.Validate(); apiErr != nil {
		ErrorFromModel(w, apiErr)
		return
	}

	cityID, err := h.cityRepo.GetIDBySlug(r.Context(), req.CitySlug)
	if err != nil {
		Error(w, 400, "invalid city: "+req.CitySlug, "")
		return
	}

	board, err := h.toletRepo.Create(r.Context(), userID, cityID, &req)
	if err != nil {
		h.logger.Error("failed to create to-let board", zap.Error(err))
		Error(w, 500, "failed to create to-let board", "")
		return
	}

	JSON(w, 201, board, nil)
}

// ListToLetBoards handles GET /api/v1/pins/tolet?city=pune&sw_lng=...
func (h *PinHandler) ListToLetBoards(w http.ResponseWriter, r *http.Request) {
	citySlug := r.URL.Query().Get("city")
	if citySlug == "" {
		Error(w, 400, "city parameter is required", "")
		return
	}

	cityID, err := h.cityRepo.GetIDBySlug(r.Context(), citySlug)
	if err != nil {
		Error(w, 400, "invalid city: "+citySlug, "")
		return
	}

	bbox, apiErr := ParseBBox(r)
	if apiErr != nil {
		ErrorFromModel(w, apiErr)
		return
	}

	pagination := ParsePagination(r)

	boards, err := h.toletRepo.ListInBBox(r.Context(), cityID, *bbox, pagination)
	if err != nil {
		h.logger.Error("failed to list to-let boards", zap.Error(err))
		Error(w, 500, "failed to list to-let boards", "")
		return
	}

	if boards == nil {
		boards = []model.ToLetBoard{}
	}

	JSON(w, 200, boards, &model.Meta{
		Count:  len(boards),
		Limit:  pagination.Limit,
		Offset: pagination.Offset,
		BBox:   bbox.ToSlice(),
	})
}

// =========================================================================
// Polygon Search
// =========================================================================

// PolygonSearch handles POST /api/v1/search/polygon
func (h *PinHandler) PolygonSearch(w http.ResponseWriter, r *http.Request) {
	var req model.PolygonSearchRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, 400, "invalid request body", err.Error())
		return
	}

	if req.CitySlug == "" {
		Error(w, 400, "city is required", "")
		return
	}
	if req.PinType == "" {
		Error(w, 400, "pin_type is required", "allowed: flats, seekers")
		return
	}

	cityID, err := h.cityRepo.GetIDBySlug(r.Context(), req.CitySlug)
	if err != nil {
		Error(w, 400, "invalid city: "+req.CitySlug, "")
		return
	}

	// Serialize the GeoJSON object to a string for PostGIS
	geoJSONBytes, err := json.Marshal(req.GeoJSON)
	if err != nil {
		Error(w, 400, "invalid geojson", err.Error())
		return
	}
	geoJSON := string(geoJSONBytes)

	pagination := ParsePagination(r)

	switch req.PinType {
	case "flats":
		pins, err := h.flatRepo.ListInPolygon(r.Context(), cityID, geoJSON, pagination)
		if err != nil {
			h.logger.Error("polygon search failed for flats", zap.Error(err))
			Error(w, 500, "polygon search failed", "")
			return
		}
		if pins == nil {
			pins = []model.FlatPin{}
		}
		JSON(w, 200, pins, &model.Meta{Count: len(pins), Limit: pagination.Limit, Offset: pagination.Offset})

	default:
		Error(w, 400, "unsupported pin_type", "allowed: flats")
	}
}
