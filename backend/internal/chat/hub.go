package chat

import (
	"sync"

	"go.uber.org/zap"
)

// Hub maintains the set of active WebSocket clients and
// handles room subscription, broadcasting, and client lifecycle.
//
// Architecture:
//
//	                ┌───────────────┐
//	  ws connect ──▶│     Hub       │◀── ws connect
//	                │               │
//	                │  clients map  │
//	                │  rooms map    │
//	                │               │
//	                └───────┬───────┘
//	                        │
//	            ┌───────────┼───────────┐
//	            ▼           ▼           ▼
//	        [Client A]  [Client B]  [Client C]
//	         room:X      room:X      room:Y
type Hub struct {
	// clients is the set of registered clients, keyed by user ID.
	// A single user can have multiple connections (multiple tabs).
	clients map[string]map[*Client]bool

	// rooms maps room IDs to the set of clients subscribed to them.
	rooms map[string]map[*Client]bool

	// register/unregister channels for client lifecycle
	register   chan *Client
	unregister chan *Client

	mu     sync.RWMutex
	logger *zap.Logger
}

// NewHub creates a new Hub.
func NewHub(logger *zap.Logger) *Hub {
	return &Hub{
		clients:    make(map[string]map[*Client]bool),
		rooms:      make(map[string]map[*Client]bool),
		register:   make(chan *Client, 64),
		unregister: make(chan *Client, 64),
		logger:     logger.Named("ws-hub"),
	}
}

// Run starts the hub's event loop. Call in a goroutine.
func (h *Hub) Run() {
	h.logger.Info("WebSocket hub started")
	for {
		select {
		case client := <-h.register:
			h.addClient(client)
		case client := <-h.unregister:
			h.removeClient(client)
		}
	}
}

// Register queues a client for registration.
func (h *Hub) Register(client *Client) {
	h.register <- client
}

// Unregister queues a client for removal.
func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

// addClient adds a client to the hub.
func (h *Hub) addClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.clients[client.userID] == nil {
		h.clients[client.userID] = make(map[*Client]bool)
	}
	h.clients[client.userID][client] = true

	h.logger.Info("client registered",
		zap.String("user_id", client.userID),
		zap.Int("total_connections", h.totalClients()),
	)
}

// removeClient removes a client from the hub and all its room subscriptions.
func (h *Hub) removeClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	// Remove from all rooms
	for roomID := range client.rooms {
		if room, ok := h.rooms[roomID]; ok {
			delete(room, client)
			if len(room) == 0 {
				delete(h.rooms, roomID)
			}
		}
	}

	// Remove from clients map
	if clients, ok := h.clients[client.userID]; ok {
		delete(clients, client)
		if len(clients) == 0 {
			delete(h.clients, client.userID)
		}
	}

	close(client.send)

	h.logger.Info("client unregistered",
		zap.String("user_id", client.userID),
		zap.Int("total_connections", h.totalClients()),
	)
}

// SubscribeToRoom adds a client to a room's broadcast list.
func (h *Hub) SubscribeToRoom(client *Client, roomID string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.rooms[roomID] == nil {
		h.rooms[roomID] = make(map[*Client]bool)
	}
	h.rooms[roomID][client] = true
	client.rooms[roomID] = true
}

// BroadcastToRoom sends a message to all clients subscribed to a room.
func (h *Hub) BroadcastToRoom(roomID string, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if clients, ok := h.rooms[roomID]; ok {
		for client := range clients {
			select {
			case client.send <- message:
			default:
				// Client's send buffer is full — drop the message.
				// The client will catch up via REST history.
				h.logger.Warn("dropping message for slow client",
					zap.String("user_id", client.userID),
					zap.String("room_id", roomID),
				)
			}
		}
	}
}

// BroadcastToUser sends a message to all connections of a specific user.
func (h *Hub) BroadcastToUser(userID string, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if clients, ok := h.clients[userID]; ok {
		for client := range clients {
			select {
			case client.send <- message:
			default:
			}
		}
	}
}

// IsUserOnline checks if a user has at least one active connection.
func (h *Hub) IsUserOnline(userID string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients[userID]) > 0
}

// totalClients returns the total number of active client connections.
// Must be called with mu held.
func (h *Hub) totalClients() int {
	total := 0
	for _, clients := range h.clients {
		total += len(clients)
	}
	return total
}
