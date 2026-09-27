// Package db manages the PostgreSQL connection pool and migration execution.
package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"pune-flats/backend/internal/config"
)

// Connect establishes a connection pool to PostgreSQL with PostGIS.
// It verifies the connection with a ping and configures pool limits
// from the provided config.
func Connect(ctx context.Context, cfg *config.DatabaseConfig, logger *zap.Logger) (*pgxpool.Pool, error) {
	poolCfg, err := pgxpool.ParseConfig(cfg.DSN())
	if err != nil {
		return nil, fmt.Errorf("parsing database DSN: %w", err)
	}

	// Connection pool tuning
	poolCfg.MaxConns = int32(cfg.MaxOpenConns)
	poolCfg.MinConns = int32(cfg.MaxIdleConns)
	poolCfg.MaxConnLifetime = cfg.ConnMaxLifetime()
	poolCfg.MaxConnIdleTime = 5 * time.Minute

	logger.Info("connecting to PostgreSQL",
		zap.String("host", cfg.Host),
		zap.Int("port", cfg.Port),
		zap.String("database", cfg.Name),
		zap.Int("max_conns", cfg.MaxOpenConns),
	)

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, fmt.Errorf("creating connection pool: %w", err)
	}

	// Verify connectivity
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("pinging database: %w", err)
	}

	// Verify PostGIS extension is available
	var postgisVersion string
	err = pool.QueryRow(ctx, "SELECT PostGIS_Version()").Scan(&postgisVersion)
	if err != nil {
		pool.Close()
		return nil, fmt.Errorf("PostGIS not available (is the extension enabled?): %w", err)
	}

	logger.Info("connected to PostgreSQL with PostGIS",
		zap.String("postgis_version", postgisVersion),
	)

	return pool, nil
}
