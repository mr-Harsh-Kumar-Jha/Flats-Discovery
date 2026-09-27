package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"pune-flats/backend/internal/model"
)

// ToLetRepository handles to_let_boards CRUD and spatial queries.
type ToLetRepository struct {
	pool *pgxpool.Pool
}

// NewToLetRepository creates a new ToLetRepository.
func NewToLetRepository(pool *pgxpool.Pool) *ToLetRepository {
	return &ToLetRepository{pool: pool}
}

// Create inserts a new to-let board entry.
// The image starts in PENDING scrub status with a blurred placeholder.
func (r *ToLetRepository) Create(ctx context.Context, userID, cityID string, req *model.CreateToLetRequest) (*model.ToLetBoard, error) {
	var board model.ToLetBoard
	err := r.pool.QueryRow(ctx, `
		INSERT INTO to_let_boards (
			uploaded_by, city_id, location,
			raw_image_key, description
		) VALUES (
			$1, $2, ST_MakePoint($3, $4)::geography,
			$5, $6
		)
		RETURNING id, uploaded_by, city_id,
		          ST_Y(location::geometry), ST_X(location::geometry),
		          raw_image_key, scrub_status::text,
		          description, created_at::text
	`, userID, cityID, req.Lng, req.Lat, req.ImageKey, req.Description,
	).Scan(
		&board.ID, &board.UploadedBy, &board.CityID,
		&board.Lat, &board.Lng,
		&board.ImageURL, &board.ScrubStatus,
		&board.Description, &board.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("inserting to-let board: %w", err)
	}
	return &board, nil
}

// ListInBBox returns to-let boards within the viewport.
// Only returns the scrubbed image URL; raw image is never exposed.
func (r *ToLetRepository) ListInBBox(ctx context.Context, cityID string, bbox model.BBox, p model.PaginationParams) ([]model.ToLetBoard, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, city_id,
		       ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
		       CASE
		           WHEN scrub_status = 'COMPLETED' THEN COALESCE(scrubbed_image_key, raw_image_key)
		           ELSE COALESCE(placeholder_key, 'placeholder')
		       END AS image_url,
		       scrub_status::text,
		       transcribed_phone, transcribed_text,
		       description, created_at::text
		FROM to_let_boards
		WHERE city_id = $1
		  AND is_active = true
		  AND location::geometry && ST_MakeEnvelope($2, $3, $4, $5, 4326)
		ORDER BY created_at DESC
		LIMIT $6 OFFSET $7
	`, cityID, bbox.SWLng, bbox.SWLat, bbox.NELng, bbox.NELat, p.Limit, p.Offset)
	if err != nil {
		return nil, fmt.Errorf("listing to-let boards in bbox: %w", err)
	}
	defer rows.Close()

	var boards []model.ToLetBoard
	for rows.Next() {
		var b model.ToLetBoard
		if err := rows.Scan(
			&b.ID, &b.CityID,
			&b.Lat, &b.Lng,
			&b.ImageURL, &b.ScrubStatus,
			&b.TranscribedPhone, &b.TranscribedText,
			&b.Description, &b.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scanning to-let board row: %w", err)
		}
		boards = append(boards, b)
	}
	return boards, rows.Err()
}
