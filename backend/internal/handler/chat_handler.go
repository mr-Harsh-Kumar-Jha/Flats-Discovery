package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"

	"pune-flats/backend/internal/chat"
	"pune-flats/backend/internal/middleware"
	"pune-flats/backend/internal/model"
	"pune-flats/backend/internal/repository"
)

// WebSocket upgrader with permissive origin check for development.
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// TODO(production): restrict to allowed origins
		return true
	},
}

// ChatHandler handles chat REST endpoints and WebSocket upgrades.
type ChatHandler struct {
	chatRepo *repository.ChatRepository
	hub      *chat.Hub
	logger   *zap.Logger
}

// NewChatHandler creates a new ChatHandler.
func NewChatHandler(chatRepo *repository.ChatRepository, hub *chat.Hub, logger *zap.Logger) *ChatHandler {
	return &ChatHandler{
		chatRepo: chatRepo,
		hub:      hub,
		logger:   logger,
	}
}

// =========================================================================
// WebSocket Endpoint
// =========================================================================

// HandleWS upgrades an HTTP connection to WebSocket.
// Authentication is via query parameter: /ws?token=<user_id>
// (In production, this would be a JWT token validated here.)
//
// After connection, the client is automatically subscribed to all
// rooms they are a member of.
func (h *ChatHandler) HandleWS(w http.ResponseWriter, r *http.Request) {
	// Extract user ID from query parameter (dev mode)
	// Production: validate JWT from query param or cookie
	userID := r.URL.Query().Get("token")
	if userID == "" {
		// Also check Authorization header for non-browser clients
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			userID = strings.TrimPrefix(authHeader, "Bearer ")
		}
	}
	if userID == "" {
		http.Error(w, "authentication required: provide ?token=<user_id>", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		h.logger.Error("websocket upgrade failed", zap.Error(err))
		return
	}

	client := chat.NewClient(h.hub, conn, userID, h.chatRepo, h.logger)

	// Register with hub
	h.hub.Register(client)

	// Auto-subscribe to user's rooms
	rooms, err := h.chatRepo.ListRoomsByUser(r.Context(), userID, model.PaginationParams{Limit: 100, Offset: 0})
	if err != nil {
		h.logger.Error("failed to load user rooms for WS", zap.Error(err))
	} else {
		for _, room := range rooms {
			h.hub.SubscribeToRoom(client, room.ID)
		}
	}

	// Send connected confirmation
	connected := model.WSOutgoingMessage{
		Type:    model.WSTypeConnected,
		Content: "connected",
	}
	connBytes, _ := json.Marshal(connected)
	client.Send(connBytes)

	// Start read/write pumps (blocking)
	go client.WritePump()
	client.ReadPump()
}

// =========================================================================
// REST Endpoints
// =========================================================================

// CreateDirectRoom handles POST /api/v1/chat/rooms/direct
// Creates a 1:1 chat room from an existing match.
func (h *ChatHandler) CreateDirectRoom(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var req model.CreateDirectRoomRequest
	if err := DecodeJSON(r, &req); err != nil {
		Error(w, 400, "invalid request body", err.Error())
		return
	}

	if req.MatchID == "" {
		Error(w, 400, "match_id is required", "")
		return
	}

	room, err := h.chatRepo.CreateDirectRoom(r.Context(), req.MatchID)
	if err != nil {
		h.logger.Error("failed to create direct room", zap.Error(err), zap.String("match_id", req.MatchID))
		Error(w, 500, "failed to create chat room", "")
		return
	}

	// Load members for the response
	members, err := h.chatRepo.GetRoomMembers(r.Context(), room.ID)
	if err == nil {
		room.Members = members
	}

	h.logger.Info("chat room created",
		zap.String("room_id", room.ID),
		zap.String("match_id", req.MatchID),
		zap.String("created_by", userID),
	)

	JSON(w, 201, room, nil)
}

// ListMyRooms handles GET /api/v1/chat/rooms
func (h *ChatHandler) ListMyRooms(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	pagination := ParsePagination(r)

	rooms, err := h.chatRepo.ListRoomsByUser(r.Context(), userID, pagination)
	if err != nil {
		h.logger.Error("failed to list rooms", zap.Error(err))
		Error(w, 500, "failed to list rooms", "")
		return
	}

	if rooms == nil {
		rooms = []model.ChatRoom{}
	}

	JSON(w, 200, rooms, &model.Meta{
		Count:  len(rooms),
		Limit:  pagination.Limit,
		Offset: pagination.Offset,
	})
}

// ListMessages handles GET /api/v1/chat/rooms/{roomId}/messages
func (h *ChatHandler) ListMessages(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	roomID := chi.URLParam(r, "roomId")

	if roomID == "" {
		Error(w, 400, "room_id is required", "")
		return
	}

	// Verify membership
	isMember, err := h.chatRepo.IsRoomMember(r.Context(), roomID, userID)
	if err != nil || !isMember {
		Error(w, 403, "not a member of this room", "")
		return
	}

	pagination := ParsePagination(r)

	msgs, err := h.chatRepo.ListMessages(r.Context(), roomID, pagination)
	if err != nil {
		h.logger.Error("failed to list messages", zap.Error(err))
		Error(w, 500, "failed to list messages", "")
		return
	}

	if msgs == nil {
		msgs = []model.ChatMessage{}
	}

	// Also mark as read while fetching
	h.chatRepo.MarkRead(r.Context(), roomID, userID)

	JSON(w, 200, msgs, &model.Meta{
		Count:  len(msgs),
		Limit:  pagination.Limit,
		Offset: pagination.Offset,
	})
}

// GetRoomMembers handles GET /api/v1/chat/rooms/{roomId}/members
func (h *ChatHandler) GetRoomMembers(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	roomID := chi.URLParam(r, "roomId")

	isMember, err := h.chatRepo.IsRoomMember(r.Context(), roomID, userID)
	if err != nil || !isMember {
		Error(w, 403, "not a member of this room", "")
		return
	}

	members, err := h.chatRepo.GetRoomMembers(r.Context(), roomID)
	if err != nil {
		Error(w, 500, "failed to list members", "")
		return
	}

	JSON(w, 200, members, &model.Meta{Count: len(members)})
}
