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

// CreateDirectRoom creates or retrieves a 1:1 chat room.
// Supports creating by match_id, target_user_id, or pin_id (finding pin owner).
// Returns the existing room if one already exists between the participants.
func (r *ChatRepository) CreateDirectRoom(ctx context.Context, currentUserID string, req model.CreateDirectRoomRequest) (*model.ChatRoom, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	var seekerUserID, flatUserID string
	var matchIDPtr *string

	if req.MatchID != "" {
		// Try to get existing room for this match
		var room model.ChatRoom
		err = tx.QueryRow(ctx, `
			SELECT id, match_id, room_type::text, is_active, last_message_at, created_at
			FROM chat_rooms
			WHERE match_id = $1 AND room_type = 'DIRECT'
		`, req.MatchID).Scan(&room.ID, &room.MatchID, &room.RoomType, &room.IsActive, &room.LastMessageAt, &room.CreatedAt)

		if err == nil {
			return &room, tx.Commit(ctx)
		}
		if err != pgx.ErrNoRows {
			return nil, fmt.Errorf("checking existing room for match: %w", err)
		}

		// Get the two users from the match
		err = tx.QueryRow(ctx, `
			SELECT seeker_user_id, flat_user_id FROM matches WHERE id = $1
		`, req.MatchID).Scan(&seekerUserID, &flatUserID)
		if err != nil {
			return nil, fmt.Errorf("fetching match users: %w", err)
		}
		matchIDPtr = &req.MatchID
	} else {
		targetUserID := req.TargetUserID
		if targetUserID == "" && req.PinID != "" {
			// Look up owner of flat pin
			_ = tx.QueryRow(ctx, `SELECT user_id FROM flat_pins WHERE id = $1`, req.PinID).Scan(&targetUserID)
			if targetUserID == "" {
				// Look up owner of seeker pin
				_ = tx.QueryRow(ctx, `SELECT user_id FROM seeker_pins WHERE id = $1`, req.PinID).Scan(&targetUserID)
			}
		}

		if targetUserID == "" {
			return nil, fmt.Errorf("target user or valid pin_id not found")
		}

		if targetUserID == currentUserID {
			return nil, fmt.Errorf("cannot start a chat with yourself")
		}

		// Check if a direct room already exists between currentUserID and targetUserID
		var room model.ChatRoom
		err = tx.QueryRow(ctx, `
			SELECT cr.id, cr.match_id, cr.room_type::text, cr.is_active, cr.last_message_at, cr.created_at
			FROM chat_rooms cr
			JOIN chat_room_members m1 ON m1.room_id = cr.id AND m1.user_id = $1 AND m1.left_at IS NULL
			JOIN chat_room_members m2 ON m2.room_id = cr.id AND m2.user_id = $2 AND m2.left_at IS NULL
			WHERE cr.room_type = 'DIRECT' AND cr.is_active = true
			LIMIT 1
		`, currentUserID, targetUserID).Scan(&room.ID, &room.MatchID, &room.RoomType, &room.IsActive, &room.LastMessageAt, &room.CreatedAt)

		if err == nil {
			return &room, tx.Commit(ctx)
		}
		if err != pgx.ErrNoRows {
			return nil, fmt.Errorf("checking existing user-to-user room: %w", err)
		}

		seekerUserID = currentUserID
		flatUserID = targetUserID
	}

	// Create the room
	var room model.ChatRoom
	err = tx.QueryRow(ctx, `
		INSERT INTO chat_rooms (match_id, room_type)
		VALUES ($1, 'DIRECT')
		RETURNING id, match_id, room_type::text, is_active, last_message_at, created_at
	`, matchIDPtr).Scan(&room.ID, &room.MatchID, &room.RoomType, &room.IsActive, &room.LastMessageAt, &room.CreatedAt)
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

	// If match was provided, update match status
	if req.MatchID != "" {
		_, _ = tx.Exec(ctx, `
			UPDATE matches SET status = 'CHAT_INITIATED', chat_initiated_at = NOW()
			WHERE id = $1 AND status IN ('PENDING', 'VIEWED')
		`, req.MatchID)
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

// InsertMessage stores a chat message (with PII scrubbing for plaintext, or encrypted flag/fingerprint for E2EE).
func (r *ChatRepository) InsertMessage(
	ctx context.Context,
	roomID, senderID, content, originalContent, contentType string,
	piiDetected bool, piiPatterns []string,
	isEncrypted bool, senderPubFingerprint *string,
) (*model.ChatMessage, error) {
	var msg model.ChatMessage
	var origPtr *string
	if piiDetected && !isEncrypted {
		origPtr = &originalContent
	}

	err := r.pool.QueryRow(ctx, `
		WITH inserted AS (
			INSERT INTO chat_messages (
				room_id, sender_id, content, original_content, content_type,
				pii_detected, pii_patterns, is_encrypted, sender_pub_fingerprint
			)
			VALUES ($1, $2, $3, $4, $5::message_content_type, $6, $7, $8, $9)
			RETURNING id, room_id, sender_id, content, content_type::text,
			          pii_detected, pii_patterns, is_encrypted, sender_pub_fingerprint, created_at::text
		),
		room_update AS (
			UPDATE chat_rooms SET last_message_at = NOW() WHERE id = $1
		)
		SELECT * FROM inserted
	`, roomID, senderID, content, origPtr, contentType, piiDetected, piiPatterns, isEncrypted, senderPubFingerprint,
	).Scan(&msg.ID, &msg.RoomID, &msg.SenderID, &msg.Content, &msg.ContentType,
		&msg.PIIDetected, &msg.PIIPatterns, &msg.IsEncrypted, &msg.SenderPubFingerprint, &msg.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("inserting message: %w", err)
	}
	return &msg, nil
}

// ListMessages returns paginated messages for a room, newest first.
func (r *ChatRepository) ListMessages(ctx context.Context, roomID string, p model.PaginationParams) ([]model.ChatMessage, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT cm.id, cm.room_id, cm.sender_id, cm.content, cm.content_type::text,
		       cm.pii_detected, cm.pii_patterns, cm.is_encrypted, cm.sender_pub_fingerprint, cm.created_at::text,
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
			&m.PIIDetected, &m.PIIPatterns, &m.IsEncrypted, &m.SenderPubFingerprint, &m.CreatedAt,
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

// =========================================================================
// E2EE Keys Operations
// =========================================================================

// SaveUserE2EEKey saves or updates the user's public ECDH identity key.
func (r *ChatRepository) SaveUserE2EEKey(ctx context.Context, userID, publicKey, algorithm, fingerprint string) (*model.UserE2EEKey, error) {
	if algorithm == "" {
		algorithm = "ECDH-P256"
	}
	var k model.UserE2EEKey
	err := r.pool.QueryRow(ctx, `
		INSERT INTO user_e2ee_keys (user_id, public_key, algorithm, fingerprint, created_at, updated_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			public_key = EXCLUDED.public_key,
			algorithm = EXCLUDED.algorithm,
			fingerprint = EXCLUDED.fingerprint,
			updated_at = NOW()
		RETURNING user_id, public_key, algorithm, fingerprint, created_at, updated_at
	`, userID, publicKey, algorithm, fingerprint).Scan(&k.UserID, &k.PublicKey, &k.Algorithm, &k.Fingerprint, &k.CreatedAt, &k.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("saving E2EE key: %w", err)
	}
	return &k, nil
}

// GetUserE2EEKey returns the ECDH public key for a user.
func (r *ChatRepository) GetUserE2EEKey(ctx context.Context, userID string) (*model.UserE2EEKey, error) {
	var k model.UserE2EEKey
	err := r.pool.QueryRow(ctx, `
		SELECT user_id, public_key, algorithm, fingerprint, created_at, updated_at
		FROM user_e2ee_keys
		WHERE user_id = $1
	`, userID).Scan(&k.UserID, &k.PublicKey, &k.Algorithm, &k.Fingerprint, &k.CreatedAt, &k.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("getting user E2EE key: %w", err)
	}
	return &k, nil
}

// GetRoomMemberKeys returns public keys of all active members in a room.
func (r *ChatRepository) GetRoomMemberKeys(ctx context.Context, roomID string) ([]model.RoomMemberKey, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT crm.user_id, u.display_name,
		       COALESCE(k.public_key, ''), COALESCE(k.algorithm, 'ECDH-P256'), COALESCE(k.fingerprint, '')
		FROM chat_room_members crm
		JOIN users u ON u.id = crm.user_id
		LEFT JOIN user_e2ee_keys k ON k.user_id = crm.user_id
		WHERE crm.room_id = $1 AND crm.left_at IS NULL
	`, roomID)
	if err != nil {
		return nil, fmt.Errorf("fetching room member keys: %w", err)
	}
	defer rows.Close()

	var keys []model.RoomMemberKey
	for rows.Next() {
		var mk model.RoomMemberKey
		if err := rows.Scan(&mk.UserID, &mk.DisplayName, &mk.PublicKey, &mk.Algorithm, &mk.Fingerprint); err != nil {
			return nil, err
		}
		keys = append(keys, mk)
	}
	return keys, rows.Err()
}
