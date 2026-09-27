package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"pune-flats/backend/internal/model"
)

// ChatRepository handles chat rooms, members, and messages.
type ChatRepository struct {
	pool *pgxpool.Pool
}

// NewChatRepository creates a new ChatRepository.
func NewChatRepository(pool *pgxpool.Pool) *ChatRepository {
	return &ChatRepository{pool: pool}
}

// =========================================================================
// Room Operations
// =========================================================================

// CreateDirectRoom creates a 1:1 chat room linked to a match.
// It auto-adds both match participants as members.
// Returns the existing room if one already exists for this match.
func (r *ChatRepository) CreateDirectRoom(ctx context.Context, matchID string) (*model.ChatRoom, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Try to get existing room for this match
	var room model.ChatRoom
	err = tx.QueryRow(ctx, `
		SELECT id, match_id, room_type::text, is_active, last_message_at, created_at
		FROM chat_rooms
		WHERE match_id = $1 AND room_type = 'DIRECT'
	`, matchID).Scan(&room.ID, &room.MatchID, &room.RoomType, &room.IsActive, &room.LastMessageAt, &room.CreatedAt)

	if err == nil {
		// Room already exists
		return &room, tx.Commit(ctx)
	}
	if err != pgx.ErrNoRows {
		return nil, fmt.Errorf("checking existing room: %w", err)
	}

	// Get the two users from the match
	var seekerUserID, flatUserID string
	err = tx.QueryRow(ctx, `
		SELECT seeker_user_id, flat_user_id FROM matches WHERE id = $1
	`, matchID).Scan(&seekerUserID, &flatUserID)
	if err != nil {
		return nil, fmt.Errorf("fetching match users: %w", err)
	}

	// Create the room
	err = tx.QueryRow(ctx, `
		INSERT INTO chat_rooms (match_id, room_type)
		VALUES ($1, 'DIRECT')
		RETURNING id, match_id, room_type::text, is_active, last_message_at, created_at
	`, matchID).Scan(&room.ID, &room.MatchID, &room.RoomType, &room.IsActive, &room.LastMessageAt, &room.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("creating chat room: %w", err)
	}

	// Add both users as members
	_, err = tx.Exec(ctx, `
		INSERT INTO chat_room_members (room_id, user_id, role)
		VALUES ($1, $2, 'MEMBER'), ($1, $3, 'MEMBER')
	`, room.ID, seekerUserID, flatUserID)
	if err != nil {
		return nil, fmt.Errorf("adding room members: %w", err)
	}

	// Update match status to CHAT_INITIATED
	_, err = tx.Exec(ctx, `
		UPDATE matches SET status = 'CHAT_INITIATED', chat_initiated_at = NOW()
		WHERE id = $1 AND status IN ('PENDING', 'VIEWED')
	`, matchID)
	if err != nil {
		return nil, fmt.Errorf("updating match status: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("committing transaction: %w", err)
	}

	return &room, nil
}

// ListRoomsByUser returns all active chat rooms for a user,
// ordered by most recent message.
func (r *ChatRepository) ListRoomsByUser(ctx context.Context, userID string, p model.PaginationParams) ([]model.ChatRoom, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT cr.id, cr.match_id, cr.room_type::text, cr.name,
		       cr.is_active, cr.last_message_at, cr.created_at,
		       (
		           SELECT COUNT(*)
		           FROM chat_messages cm
		           WHERE cm.room_id = cr.id
		             AND cm.created_at > COALESCE(crm.last_read_at, '1970-01-01'::timestamptz)
		       ) AS unread_count
		FROM chat_rooms cr
		JOIN chat_room_members crm ON crm.room_id = cr.id
		WHERE crm.user_id = $1
		  AND crm.left_at IS NULL
		  AND cr.is_active = true
		ORDER BY COALESCE(cr.last_message_at, cr.created_at) DESC
		LIMIT $2 OFFSET $3
	`, userID, p.Limit, p.Offset)
	if err != nil {
		return nil, fmt.Errorf("listing rooms: %w", err)
	}
	defer rows.Close()

	var rooms []model.ChatRoom
	for rows.Next() {
		var room model.ChatRoom
		if err := rows.Scan(
			&room.ID, &room.MatchID, &room.RoomType, &room.Name,
			&room.IsActive, &room.LastMessageAt, &room.CreatedAt,
			&room.UnreadCount,
		); err != nil {
			return nil, fmt.Errorf("scanning room: %w", err)
		}
		rooms = append(rooms, room)
	}
	return rooms, rows.Err()
}

// GetRoomMembers returns all active members of a room.
func (r *ChatRepository) GetRoomMembers(ctx context.Context, roomID string) ([]model.ChatRoomMember, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT crm.id, crm.room_id, crm.user_id, crm.role::text,
		       crm.joined_at, crm.last_read_at, crm.is_muted,
		       u.display_name
		FROM chat_room_members crm
		JOIN users u ON u.id = crm.user_id
		WHERE crm.room_id = $1 AND crm.left_at IS NULL
	`, roomID)
	if err != nil {
		return nil, fmt.Errorf("fetching room members: %w", err)
	}
	defer rows.Close()

	var members []model.ChatRoomMember
	for rows.Next() {
		var m model.ChatRoomMember
		if err := rows.Scan(
			&m.ID, &m.RoomID, &m.UserID, &m.Role,
			&m.JoinedAt, &m.LastReadAt, &m.IsMuted,
			&m.DisplayName,
		); err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	return members, rows.Err()
}

// IsRoomMember checks if a user is an active member of a room.
func (r *ChatRepository) IsRoomMember(ctx context.Context, roomID, userID string) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM chat_room_members
			WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
		)
	`, roomID, userID).Scan(&exists)
	return exists, err
}

// GetRoomMemberUserIDs returns user IDs of all active members.
func (r *ChatRepository) GetRoomMemberUserIDs(ctx context.Context, roomID string) ([]string, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT user_id FROM chat_room_members
		WHERE room_id = $1 AND left_at IS NULL
	`, roomID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// =========================================================================
// Message Operations
// =========================================================================

// InsertMessage stores a chat message (with PII scrubbing already applied).
func (r *ChatRepository) InsertMessage(ctx context.Context, roomID, senderID, content, originalContent, contentType string, piiDetected bool, piiPatterns []string) (*model.ChatMessage, error) {
	var msg model.ChatMessage
	var origPtr *string
	if piiDetected {
		origPtr = &originalContent
	}

	err := r.pool.QueryRow(ctx, `
		WITH inserted AS (
			INSERT INTO chat_messages (room_id, sender_id, content, original_content, content_type, pii_detected, pii_patterns)
			VALUES ($1, $2, $3, $4, $5::message_content_type, $6, $7)
			RETURNING id, room_id, sender_id, content, content_type::text, pii_detected, pii_patterns, created_at::text
		),
		room_update AS (
			UPDATE chat_rooms SET last_message_at = NOW() WHERE id = $1
		)
		SELECT * FROM inserted
	`, roomID, senderID, content, origPtr, contentType, piiDetected, piiPatterns,
	).Scan(&msg.ID, &msg.RoomID, &msg.SenderID, &msg.Content, &msg.ContentType,
		&msg.PIIDetected, &msg.PIIPatterns, &msg.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("inserting message: %w", err)
	}
	return &msg, nil
}

// ListMessages returns paginated messages for a room, newest first.
func (r *ChatRepository) ListMessages(ctx context.Context, roomID string, p model.PaginationParams) ([]model.ChatMessage, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT cm.id, cm.room_id, cm.sender_id, cm.content, cm.content_type::text,
		       cm.pii_detected, cm.pii_patterns, cm.created_at::text,
		       u.display_name AS sender_display_name
		FROM chat_messages cm
		JOIN users u ON u.id = cm.sender_id
		WHERE cm.room_id = $1
		ORDER BY cm.created_at DESC
		LIMIT $2 OFFSET $3
	`, roomID, p.Limit, p.Offset)
	if err != nil {
		return nil, fmt.Errorf("listing messages: %w", err)
	}
	defer rows.Close()

	var msgs []model.ChatMessage
	for rows.Next() {
		var m model.ChatMessage
		if err := rows.Scan(
			&m.ID, &m.RoomID, &m.SenderID, &m.Content, &m.ContentType,
			&m.PIIDetected, &m.PIIPatterns, &m.CreatedAt,
			&m.SenderDisplayName,
		); err != nil {
			return nil, err
		}
		msgs = append(msgs, m)
	}
	return msgs, rows.Err()
}

// MarkRead updates the user's last_read_at timestamp for a room.
func (r *ChatRepository) MarkRead(ctx context.Context, roomID, userID string) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE chat_room_members SET last_read_at = NOW()
		WHERE room_id = $1 AND user_id = $2
	`, roomID, userID)
	return err
}

// GetSenderDisplayName returns the display name for a user.
func (r *ChatRepository) GetSenderDisplayName(ctx context.Context, userID string) (string, error) {
	var name string
	err := r.pool.QueryRow(ctx, `SELECT display_name FROM users WHERE id = $1`, userID).Scan(&name)
	return name, err
}
