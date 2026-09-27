package chat

import (
	"context"
	"encoding/json"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"

	"pune-flats/backend/internal/model"
	"pune-flats/backend/internal/repository"
)

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer (5KB).
	maxMessageSize = 5 * 1024

	// Send channel buffer size.
	sendBufferSize = 256
)

// Client is a middleman between the WebSocket connection and the hub.
type Client struct {
	hub      *Hub
	conn     *websocket.Conn
	userID   string
	chatRepo *repository.ChatRepository
	logger   *zap.Logger

	// ctx is the connection-scoped context, cancelled on disconnect.
	ctx    context.Context
	cancel context.CancelFunc

	// send is a buffered channel of outbound messages.
	send chan []byte

	// rooms is the set of room IDs this client is subscribed to.
	rooms map[string]bool
}

// NewClient creates a new WebSocket client.
func NewClient(hub *Hub, conn *websocket.Conn, userID string, chatRepo *repository.ChatRepository, logger *zap.Logger) *Client {
	ctx, cancel := context.WithCancel(context.Background())
	return &Client{
		hub:      hub,
		conn:     conn,
		userID:   userID,
		chatRepo: chatRepo,
		logger:   logger.Named("ws-client"),
		ctx:      ctx,
		cancel:   cancel,
		send:     make(chan []byte, sendBufferSize),
		rooms:    make(map[string]bool),
	}
}

// Send queues a message for delivery to this client.
func (c *Client) Send(msg []byte) {
	select {
	case c.send <- msg:
	default:
	}
}

// ReadPump pumps messages from the WebSocket connection to the hub.
//
// The application runs ReadPump in a per-connection goroutine. It ensures
// that there is at most one reader on a connection by executing all
// reads from this goroutine.
func (c *Client) ReadPump() {
	defer func() {
		c.cancel()
		c.hub.Unregister(c)
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, raw, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				c.logger.Warn("unexpected close", zap.Error(err), zap.String("user_id", c.userID))
			}
			return
		}

		c.handleIncoming(raw)
	}
}

// WritePump pumps messages from the hub to the WebSocket connection.
//
// A goroutine running WritePump is started for each connection. It ensures
// that there is at most one writer to a connection by executing all
// writes from this goroutine.
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub closed the channel.
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Drain queued messages into the same write batch.
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte("\n"))
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleIncoming processes a raw incoming WebSocket message.
func (c *Client) handleIncoming(raw []byte) {
	var msg model.WSIncomingMessage
	if err := json.Unmarshal(raw, &msg); err != nil {
		c.sendError("invalid message format")
		return
	}

	switch msg.Type {
	case model.WSTypeMessage:
		c.handleChatMessage(msg)
	case model.WSTypeRead:
		c.handleReadReceipt(msg)
	case model.WSTypeTyping:
		c.handleTypingIndicator(msg)
	default:
		c.sendError("unknown message type: " + msg.Type)
	}
}

// handleChatMessage processes a new chat message from a client.
func (c *Client) handleChatMessage(msg model.WSIncomingMessage) {
	if msg.RoomID == "" || msg.Content == "" {
		c.sendError("room_id and content are required")
		return
	}

	// Verify membership
	isMember, err := c.chatRepo.IsRoomMember(c.ctx, msg.RoomID, c.userID)
	if err != nil || !isMember {
		c.sendError("not a member of this room")
		return
	}

	contentType := msg.ContentType
	if contentType == "" {
		contentType = model.ContentTypeText
	}

	// PII scrubbing
	piiResult := ScrubPII(msg.Content)

	displayContent := msg.Content
	originalContent := msg.Content
	if piiResult.HasPII {
		displayContent = piiResult.ScrubbedContent
	}

	// Store the message
	stored, err := c.chatRepo.InsertMessage(
		c.ctx, msg.RoomID, c.userID,
		displayContent, originalContent, contentType,
		piiResult.HasPII, piiResult.Patterns,
	)
	if err != nil {
		c.logger.Error("failed to store message", zap.Error(err))
		c.sendError("failed to send message")
		return
	}

	// Get sender display name
	senderName, _ := c.chatRepo.GetSenderDisplayName(c.ctx, c.userID)

	// Broadcast to room
	outgoing := model.WSOutgoingMessage{
		Type:        model.WSTypeMessage,
		RoomID:      msg.RoomID,
		MessageID:   stored.ID,
		SenderID:    c.userID,
		SenderName:  senderName,
		Content:     displayContent,
		ContentType: contentType,
		PIIDetected: piiResult.HasPII,
		PIIPatterns: piiResult.Patterns,
		CreatedAt:   stored.CreatedAt,
	}

	outBytes, _ := json.Marshal(outgoing)
	c.hub.BroadcastToRoom(msg.RoomID, outBytes)

	if piiResult.HasPII {
		c.logger.Info("PII detected and scrubbed",
			zap.String("room_id", msg.RoomID),
			zap.String("user_id", c.userID),
			zap.Strings("patterns", piiResult.Patterns),
		)
	}
}

// handleReadReceipt marks messages as read for the user in a room.
func (c *Client) handleReadReceipt(msg model.WSIncomingMessage) {
	if msg.RoomID == "" {
		return
	}
	c.chatRepo.MarkRead(c.ctx, msg.RoomID, c.userID)
}

// handleTypingIndicator broadcasts a typing indicator to room members.
func (c *Client) handleTypingIndicator(msg model.WSIncomingMessage) {
	if msg.RoomID == "" {
		return
	}

	outgoing := model.WSOutgoingMessage{
		Type:     model.WSTypeTyping,
		RoomID:   msg.RoomID,
		SenderID: c.userID,
	}
	outBytes, _ := json.Marshal(outgoing)
	c.hub.BroadcastToRoom(msg.RoomID, outBytes)
}

// sendError sends an error message back to this client only.
func (c *Client) sendError(message string) {
	outgoing := model.WSOutgoingMessage{
		Type:  model.WSTypeError,
		Error: message,
	}
	outBytes, _ := json.Marshal(outgoing)
	select {
	case c.send <- outBytes:
	default:
	}
}
