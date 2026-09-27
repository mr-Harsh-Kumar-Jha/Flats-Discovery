// Package handler contains HTTP handlers for the API.
package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"pune-flats/backend/internal/model"
)

// JSON writes a successful JSON response with the API envelope.
func JSON(w http.ResponseWriter, status int, data interface{}, meta *model.Meta) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(model.APIResponse{
		Data: data,
		Meta: meta,
	})
}

// Error writes a JSON error response.
func Error(w http.ResponseWriter, status int, message string, details string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(model.APIResponse{
		Error: &model.APIError{
			Code:    status,
			Message: message,
			Details: details,
		},
	})
}

// ErrorFromModel writes a JSON error from a model.APIError.
func ErrorFromModel(w http.ResponseWriter, apiErr *model.APIError) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(apiErr.Code)
	json.NewEncoder(w).Encode(model.APIResponse{
		Error: apiErr,
	})
}

// DecodeJSON decodes the request body into the given struct.
func DecodeJSON(r *http.Request, v interface{}) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(v)
}

// ParseBBox extracts bounding box parameters from query string.
// Expected format: ?sw_lng=73.8&sw_lat=18.5&ne_lng=73.9&ne_lat=18.6
func ParseBBox(r *http.Request) (*model.BBox, *model.APIError) {
	swLng, err1 := strconv.ParseFloat(r.URL.Query().Get("sw_lng"), 64)
	swLat, err2 := strconv.ParseFloat(r.URL.Query().Get("sw_lat"), 64)
	neLng, err3 := strconv.ParseFloat(r.URL.Query().Get("ne_lng"), 64)
	neLat, err4 := strconv.ParseFloat(r.URL.Query().Get("ne_lat"), 64)

	if err1 != nil || err2 != nil || err3 != nil || err4 != nil {
		return nil, &model.APIError{
			Code:    400,
			Message: "missing or invalid bounding box parameters",
			Details: "required: sw_lng, sw_lat, ne_lng, ne_lat (float64)",
		}
	}

	bbox := &model.BBox{SWLng: swLng, SWLat: swLat, NELng: neLng, NELat: neLat}
	if !bbox.IsValid() {
		return nil, &model.APIError{
			Code:    400,
			Message: "invalid bounding box: sw must be less than ne, coords must be in valid range",
		}
	}

	return bbox, nil
}

// ParsePagination extracts limit/offset from query string with defaults.
func ParsePagination(r *http.Request) model.PaginationParams {
	p := model.DefaultPagination()

	if l := r.URL.Query().Get("limit"); l != "" {
		if limit, err := strconv.Atoi(l); err == nil && limit > 0 && limit <= 50 {
			p.Limit = limit
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if offset, err := strconv.Atoi(o); err == nil && offset >= 0 {
			p.Offset = offset
		}
	}

	return p
}
