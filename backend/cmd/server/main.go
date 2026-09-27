// Pune-Flats API Server — Entrypoint
//
// This is the main entry point for the Go backend. It:
//  1. Loads configuration from environment variables
//  2. Connects to PostgreSQL + PostGIS
//  3. Runs pending database migrations
//  4. Initializes repositories, handlers, and middleware
//  5. Starts the Chi HTTP router
//  6. Handles graceful shutdown on SIGINT/SIGTERM
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"go.uber.org/zap"

	"pune-flats/backend/internal/chat"
	"pune-flats/backend/internal/config"
	"pune-flats/backend/internal/db"
	"pune-flats/backend/internal/handler"
	"pune-flats/backend/internal/matching"
	mw "pune-flats/backend/internal/middleware"
	"pune-flats/backend/internal/repository"
)

func main() {
	// -----------------------------------------------------------------------
	// Logger
	// -----------------------------------------------------------------------
	logger, err := zap.NewDevelopment()
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to initialize logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync()

	logger.Info("starting Pune-Flats API server")

	// -----------------------------------------------------------------------
	// Configuration
	// -----------------------------------------------------------------------
	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("failed to load configuration", zap.Error(err))
	}

	logger.Info("configuration loaded",
		zap.String("env", cfg.API.Env),
		zap.Int("port", cfg.API.Port),
		zap.String("db_host", cfg.Database.Host),
	)

	// -----------------------------------------------------------------------
	// Database
	// -----------------------------------------------------------------------
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := db.Connect(ctx, &cfg.Database, logger)
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer pool.Close()

	// -----------------------------------------------------------------------
	// Migrations
	// -----------------------------------------------------------------------
	migrationsPath := "migrations"
	if _, err := os.Stat(migrationsPath); os.IsNotExist(err) {
		migrationsPath = "backend/migrations"
	}

	if err := db.RunMigrations(cfg.Database.DSN(), migrationsPath, logger); err != nil {
		logger.Fatal("failed to run migrations", zap.Error(err))
	}

	// -----------------------------------------------------------------------
	// Repositories
	// -----------------------------------------------------------------------
	cityRepo := repository.NewCityRepository(pool)
	flatRepo := repository.NewFlatPinRepository(pool)
	seekerRepo := repository.NewSeekerPinRepository(pool)
	heatmapRepo := repository.NewHeatmapRepository(pool)
	toletRepo := repository.NewToLetRepository(pool)
	matchRepo := repository.NewMatchRepository(pool)
	chatRepo := repository.NewChatRepository(pool)

	// -----------------------------------------------------------------------
	// WebSocket Hub
	// -----------------------------------------------------------------------
	wsHub := chat.NewHub(logger)
	go wsHub.Run()

	// -----------------------------------------------------------------------
	// Handlers
	// -----------------------------------------------------------------------
	cityHandler := handler.NewCityHandler(cityRepo, logger)
	pinHandler := handler.NewPinHandler(flatRepo, seekerRepo, heatmapRepo, toletRepo, cityRepo, matchRepo, logger)
	matchHandler := handler.NewMatchHandler(matchRepo, logger)
	chatHandler := handler.NewChatHandler(chatRepo, wsHub, logger)

	// -----------------------------------------------------------------------
	// Background Workers
	// -----------------------------------------------------------------------
	workerCtx, workerCancel := context.WithCancel(context.Background())
	defer workerCancel()

	matchWorker := matching.NewWorker(matchRepo, 5*time.Second, logger)
	go matchWorker.Run(workerCtx)

	// -----------------------------------------------------------------------
	// Router
	// -----------------------------------------------------------------------
	r := chi.NewRouter()

	// Global middleware stack
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(chimw.Timeout(30 * time.Second))

	// CORS
	origins := strings.Split(cfg.API.CORSOrigins, ",")
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   origins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Request-ID", "X-Dev-User-ID"},
		ExposedHeaders:   []string{"Link", "X-Request-ID"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// -----------------------------------------------------------------------
	// Routes
	// -----------------------------------------------------------------------

	// Health check (no auth)
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()

		dbStatus := "ok"
		if err := pool.Ping(ctx); err != nil {
			dbStatus = fmt.Sprintf("error: %v", err)
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":  "ok",
			"service": "pune-flats-api",
			"version": "0.1.0",
			"env":     cfg.API.Env,
			"db":      dbStatus,
			"time":    time.Now().UTC().Format(time.RFC3339),
		})
	})

	// WebSocket (no Chi timeout middleware — long-lived connection)
	r.Get("/ws", chatHandler.HandleWS)

	// API v1
	r.Route("/api/v1", func(r chi.Router) {
		// Public routes (no auth required)
		r.Get("/cities", cityHandler.ListActive)

		// Pin routes with bbox size guard
		r.Group(func(r chi.Router) {
			r.Use(mw.BBoxSizeGuard(cfg.Features.MaxBBoxAreaKM2))

			// Heatmap is public (aggregate data, no PII)
			r.Get("/pins/heatmap", pinHandler.ListHeatmap)

			// Pin listing requires no auth (read-only, masked data)
			r.Get("/pins/flats", pinHandler.ListFlatPins)
			r.Get("/pins/flats/{id}", pinHandler.GetFlatPin)
			r.Get("/pins/seekers", pinHandler.ListSeekerPins)
			r.Get("/pins/seekers/{id}", pinHandler.GetSeekerPin)
			r.Get("/pins/tolet", pinHandler.ListToLetBoards)
		})

		// Authenticated routes (require user identity)
		r.Group(func(r chi.Router) {
			r.Use(mw.DevAuth(&cfg.API))

			// Pin creation
			r.Post("/pins/flats", pinHandler.CreateFlatPin)
			r.Post("/pins/seekers", pinHandler.CreateSeekerPin)
			r.Post("/pins/heatmap", pinHandler.CreateHeatmapPin)
			r.Post("/pins/tolet", pinHandler.CreateToLetBoard)

			// Polygon search
			r.Post("/search/polygon", pinHandler.PolygonSearch)

			// Matches
			r.Get("/matches", matchHandler.ListMyMatches)

			// Chat
			r.Route("/chat", func(r chi.Router) {
				r.Post("/rooms/direct", chatHandler.CreateDirectRoom)
				r.Get("/rooms", chatHandler.ListMyRooms)
				r.Get("/rooms/{roomId}/messages", chatHandler.ListMessages)
				r.Get("/rooms/{roomId}/members", chatHandler.GetRoomMembers)
			})
		})
	})

	// -----------------------------------------------------------------------
	// Server
	// -----------------------------------------------------------------------
	srv := &http.Server{
		Addr:         cfg.API.Addr(),
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		logger.Info("HTTP server starting", zap.String("addr", srv.Addr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("HTTP server error", zap.Error(err))
		}
	}()

	// -----------------------------------------------------------------------
	// Graceful Shutdown
	// -----------------------------------------------------------------------
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	sig := <-quit
	logger.Info("received shutdown signal", zap.String("signal", sig.String()))

	// Stop background workers first
	workerCancel()
	logger.Info("background workers stopped")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("forced shutdown", zap.Error(err))
	}

	logger.Info("server stopped gracefully")
}
