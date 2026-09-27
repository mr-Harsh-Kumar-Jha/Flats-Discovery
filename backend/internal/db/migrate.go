package db

import (
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"go.uber.org/zap"
)

// RunMigrations executes all pending database migrations from the given directory.
// It uses golang-migrate which tracks applied migrations in a schema_migrations table.
// This is safe to call on every startup — already-applied migrations are skipped.
func RunMigrations(dsn string, migrationsPath string, logger *zap.Logger) error {
	logger.Info("running database migrations",
		zap.String("path", migrationsPath),
	)

	m, err := migrate.New(
		fmt.Sprintf("file://%s", migrationsPath),
		dsn,
	)
	if err != nil {
		return fmt.Errorf("initializing migrator: %w", err)
	}
	defer m.Close()

	// Get current version for logging
	version, dirty, _ := m.Version()
	logger.Info("current migration state",
		zap.Uint("version", version),
		zap.Bool("dirty", dirty),
	)

	if dirty {
		logger.Warn("database is in a dirty migration state — attempting to force the current version",
			zap.Uint("version", version),
		)
		if err := m.Force(int(version)); err != nil {
			return fmt.Errorf("forcing migration version %d: %w", version, err)
		}
	}

	if err := m.Up(); err != nil {
		if err == migrate.ErrNoChange {
			logger.Info("all migrations already applied — no changes")
			return nil
		}
		return fmt.Errorf("applying migrations: %w", err)
	}

	newVersion, _, _ := m.Version()
	logger.Info("migrations applied successfully",
		zap.Uint("from_version", version),
		zap.Uint("to_version", newVersion),
	)

	return nil
}
