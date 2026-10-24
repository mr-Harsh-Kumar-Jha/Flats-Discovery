package model

import "time"

// =========================================================================
// Chat Rooms
// =========================================================================

// ChatRoom represents a conversation room.
type ChatRoom struct {
	ID            string     `json:"id"`
	MatchID       *string    `json:"match_id,omitempty"`
	RoomType      string     `json:"room_type"` // DIRECT, GROUP
	Name          *string    `json:"name,omitempty"`
	IsActive      bool       `json:"is_active"`
	LastMessageAt *time.Time `json:"last_message_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`

	// Populated by list queries (not stored in chat_rooms)
	Members     []ChatRoomMember `json:"members,omitempty"`
	UnreadCount int              `json:"unread_count,omitempty"`
}

// CreateDirectRoomRequest is the request to create a 1:1 chat room from a match or direct pin/user.
type CreateDirectRoomRequest struct {
	MatchID      string `json:"match_id,omitempty"`
	TargetUserID string `json:"target_user_id,omitempty"`
	PinID        string `json:"pin_id,omitempty"`
}

// CreateGroupRoomRequest is the request to create a group chat room.
type CreateGroupRoomRequest struct {
	Name      string   `json:"name"`
	MemberIDs []string `json:"member_ids"`
}

// =========================================================================
// E2EE Cryptographic Keys
// =========================================================================

// UserE2EEKey stores a user's public ECDH identity key and verification fingerprint.
type UserE2EEKey struct {
	UserID      string    `json:"user_id"`
	PublicKey   string    `json:"public_key"`
	Algorithm   string    `json:"algorithm"`
	Fingerprint string    `json:"fingerprint"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// RegisterKeyRequest is the payload to publish a user's ECDH public key.
type RegisterKeyRequest struct {
	PublicKey   string `json:"public_key"`
	Algorithm   string `json:"algorithm,omitempty"`
	Fingerprint string `json:"fingerprint,omitempty"`
}

// RoomMemberKey represents a chat participant's identity and public key for E2EE derivation.
type RoomMemberKey struct {
	UserID      string `json:"user_id"`
	DisplayName string `json:"display_name"`
	PublicKey   string `json:"public_key"`
	Algorithm   string `json:"algorithm"`
	Fingerprint string `json:"fingerprint"`
}

// =========================================================================
// Chat Room Members
// =========================================================================

// ChatRoomMember represents a user's membership in a chat room.
type ChatRoomMember struct {
	ID         string     `json:"id"`
	RoomID     string     `json:"room_id"`
	UserID     string     `json:"user_id"`
	Role       string     `json:"role"` // MEMBER, ADMIN
	JoinedAt   time.Time  `json:"joined_at"`
	LastReadAt *time.Time `json:"last_read_at,omitempty"`
	IsMuted    bool       `json:"is_muted"`
	LeftAt     *time.Time `json:"left_at,omitempty"`

	// Denormalized from users table for display
	DisplayName string `json:"display_name,omitempty"`
}

// =========================================================================
// Chat Messages
// =========================================================================

// ChatMessage represents a single message in a chat room.
type ChatMessage struct {
	ID                   string   `json:"id"`
	RoomID               string   `json:"room_id"`
	SenderID             string   `json:"sender_id"`
	Content              string   `json:"content"`      // Displayed content (or ciphertext bundle when is_encrypted is true)
	ContentType          string   `json:"content_type"`  // TEXT, IMAGE, SYSTEM
	MediaURL             *string  `json:"media_url,omitempty"`
	PIIDetected          bool     `json:"pii_detected"`
	PIIPatterns          []string `json:"pii_patterns,omitempty"` // What patterns were found
	IsEncrypted          bool     `json:"is_encrypted"`
	SenderPubFingerprint *string  `json:"sender_pub_fingerprint,omitempty"`
	CreatedAt            string   `json:"created_at"`

	// Denormalized for display
	SenderDisplayName string `json:"sender_display_name,omitempty"`
}

// Content types
const (
	ContentTypeText   = "TEXT"
	ContentTypeImage  = "IMAGE"
	ContentTypeSystem = "SYSTEM"
)

// Room types
const (
	RoomTypeDirect = "DIRECT"
	RoomTypeGroup  = "GROUP"
)

// =========================================================================
// WebSocket Protocol
// =========================================================================

// WSIncomingMessage is the JSON structure for messages from client → server.
type WSIncomingMessage struct {
	Type                 string `json:"type"`                   // "message", "typing", "read", "subscribe"
	RoomID               string `json:"room_id"`
	Content              string `json:"content,omitempty"`
	ContentType          string `json:"content_type,omitempty"` // defaults to TEXT
	IsEncrypted          bool   `json:"is_encrypted,omitempty"`
	SenderPubFingerprint string `json:"sender_pub_fingerprint,omitempty"`
}

// WSOutgoingMessage is the JSON structure for messages from server → client.
type WSOutgoingMessage struct {
	Type                 string   `json:"type"`                  // "message", "typing", "error", "room_update", "connected"
	RoomID               string   `json:"room_id,omitempty"`
	MessageID            string   `json:"message_id,omitempty"`
	SenderID             string   `json:"sender_id,omitempty"`
	SenderName           string   `json:"sender_name,omitempty"`
	Content              string   `json:"content,omitempty"`
	ContentType          string   `json:"content_type,omitempty"`
	PIIDetected          bool     `json:"pii_detected,omitempty"`
	PIIPatterns          []string `json:"pii_patterns,omitempty"`
	IsEncrypted          bool     `json:"is_encrypted,omitempty"`
	SenderPubFingerprint string   `json:"sender_pub_fingerprint,omitempty"`
	CreatedAt            string   `json:"created_at,omitempty"`
	Error                string   `json:"error,omitempty"`
}

// WS message types
const (
	WSTypeMessage    = "message"
	WSTypeTyping     = "typing"
	WSTypeRead       = "read"
	WSTypeError      = "error"
	WSTypeRoomUpdate = "room_update"
	WSTypeConnected  = "connected"
	WSTypeSubscribe  = "subscribe"
)
