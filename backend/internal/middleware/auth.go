// Package middleware contains Chi middleware for auth, rate limiting, etc.
package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"pune-flats/backend/internal/config"
	"pune-flats/backend/internal/model"
)

type contextKey string

const UserIDKey contextKey = "user_id"

// DevAuth is a development-only auth middleware.
// In development mode (API_ENV=development), it accepts:
//   - X-Dev-User-ID header → directly sets the user ID in context
//   - Authorization: Bearer <token> → placeholder for real JWT (Step 3.4)
//
// In production, this middleware MUST be replaced with real JWT validation.
func DevAuth(cfg *config.APIConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var userID string

			// Development shortcut: use X-Dev-User-ID header
			if cfg.IsDevelopment() {
				if devID := r.Header.Get("X-Dev-User-ID"); devID != "" {
					userID = devID
				}
			}

			// Try Authorization header (placeholder — real JWT in Step 3.4)
			if userID == "" {
				authHeader := r.Header.Get("Authorization")
				if strings.HasPrefix(authHeader, "Bearer ") {
					// TODO(step-3.4): Validate JWT and extract user_id from claims
					// For now, treat the token as the user_id in development
					if cfg.IsDevelopment() {
						userID = strings.TrimPrefix(authHeader, "Bearer ")
					}
				}
			}

			if userID == "" {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				w.Write([]byte(`{"error":{"code":401,"message":"authentication required","details":"provide X-Dev-User-ID header (dev) or Authorization: Bearer <token>"}}`))
				return
			}

			ctx := context.WithValue(r.Context(), UserIDKey, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetUserID extracts the authenticated user ID from the request context.
func GetUserID(ctx context.Context) string {
	if id, ok := ctx.Value(UserIDKey).(string); ok {
		return id
	}
	return ""
}

// BBoxSizeGuard rejects bounding box queries that exceed the configured max area.
// This is an anti-scraping measure — prevents city-wide data dumps.
func BBoxSizeGuard(maxAreaKM2 float64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Only check GET requests with bbox params
			if r.Method == http.MethodGet && r.URL.Query().Get("sw_lng") != "" {
				bbox, apiErr := parseBBoxFromQuery(r)
				if apiErr != nil {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(apiErr.Code)
					return
				}
				area := bbox.ApproxAreaKM2()
				if area > maxAreaKM2 {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusBadRequest)
					msg := fmt.Sprintf(`{"error":{"code":400,"message":"bounding box too large","details":"maximum area is %.0f km². Zoom in to load data."}}`, maxAreaKM2)
					w.Write([]byte(msg))
					return
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

// parseBBoxFromQuery is a lightweight bbox parser for the middleware layer.
func parseBBoxFromQuery(r *http.Request) (*model.BBox, *model.APIError) {
	q := r.URL.Query()

	swLng, err1 := strconv.ParseFloat(q.Get("sw_lng"), 64)
	swLat, err2 := strconv.ParseFloat(q.Get("sw_lat"), 64)
	neLng, err3 := strconv.ParseFloat(q.Get("ne_lng"), 64)
	neLat, err4 := strconv.ParseFloat(q.Get("ne_lat"), 64)

	if err1 != nil || err2 != nil || err3 != nil || err4 != nil {
		return nil, &model.APIError{Code: 400, Message: "invalid bbox parameters"}
	}

	return &model.BBox{SWLng: swLng, SWLat: swLat, NELng: neLng, NELat: neLat}, nil
}
