// Package config loads environment variables into typed structs.
// All configuration is injected via .env — no hardcoded values.
package config

import (
	"fmt"
	"time"

	"github.com/kelseyhightower/envconfig"
)

// Config holds all application configuration, loaded from environment variables.
type Config struct {
	Database DatabaseConfig
	API      APIConfig
	JWT      JWTConfig
	OTP      OTPConfig
	S3       S3Config
	Features FeatureFlags
}

// DatabaseConfig holds PostGIS connection parameters.
type DatabaseConfig struct {
	Host               string `envconfig:"DB_HOST" required:"true"`
	Port               int    `envconfig:"DB_PORT" default:"5432"`
	User               string `envconfig:"DB_USER" required:"true"`
	Password           string `envconfig:"DB_PASSWORD" required:"true"`
	Name               string `envconfig:"DB_NAME" required:"true"`
	SSLMode            string `envconfig:"DB_SSLMODE" default:"disable"`
	MaxOpenConns       int    `envconfig:"DB_MAX_OPEN_CONNS" default:"25"`
	MaxIdleConns       int    `envconfig:"DB_MAX_IDLE_CONNS" default:"5"`
	ConnMaxLifetimeMin int    `envconfig:"DB_CONN_MAX_LIFETIME_MINUTES" default:"30"`
}

// DSN returns the PostgreSQL connection string.
func (d *DatabaseConfig) DSN() string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=%s",
		d.User, d.Password, d.Host, d.Port, d.Name, d.SSLMode,
	)
}

// ConnMaxLifetime returns the connection max lifetime as a time.Duration.
func (d *DatabaseConfig) ConnMaxLifetime() time.Duration {
	return time.Duration(d.ConnMaxLifetimeMin) * time.Minute
}

// APIConfig holds HTTP server parameters.
type APIConfig struct {
	Port        int    `envconfig:"API_PORT" default:"8080"`
	Env         string `envconfig:"API_ENV" default:"development"`
	CORSOrigins string `envconfig:"CORS_ORIGINS" default:"http://localhost:5173"`
}

// IsDevelopment returns true if the API is running in development mode.
func (a *APIConfig) IsDevelopment() bool {
	return a.Env == "development"
}

// Addr returns the server listen address.
func (a *APIConfig) Addr() string {
	return fmt.Sprintf(":%d", a.Port)
}

// JWTConfig holds token signing and TTL parameters.
type JWTConfig struct {
	Secret             string `envconfig:"JWT_SECRET" required:"true"`
	AccessTokenTTLMin  int    `envconfig:"JWT_ACCESS_TOKEN_TTL_MINUTES" default:"15"`
	RefreshTokenTTLDay int    `envconfig:"JWT_REFRESH_TOKEN_TTL_DAYS" default:"7"`
}

// AccessTokenTTL returns the access token TTL as a time.Duration.
func (j *JWTConfig) AccessTokenTTL() time.Duration {
	return time.Duration(j.AccessTokenTTLMin) * time.Minute
}

// RefreshTokenTTL returns the refresh token TTL as a time.Duration.
func (j *JWTConfig) RefreshTokenTTL() time.Duration {
	return time.Duration(j.RefreshTokenTTLDay) * 24 * time.Hour
}

// OTPConfig holds OTP provider parameters.
type OTPConfig struct {
	Provider      string `envconfig:"OTP_PROVIDER" default:"twilio"`
	APIKey        string `envconfig:"OTP_PROVIDER_API_KEY"`
	APISecret     string `envconfig:"OTP_PROVIDER_API_SECRET"`
	AccountSID    string `envconfig:"OTP_TWILIO_ACCOUNT_SID"`
	ServiceSID    string `envconfig:"OTP_TWILIO_SERVICE_SID"`
	TTLMinutes    int    `envconfig:"OTP_TTL_MINUTES" default:"5"`
	MaxAttempts   int    `envconfig:"OTP_MAX_ATTEMPTS" default:"3"`
}

// S3Config holds AWS S3 parameters.
type S3Config struct {
	Region          string `envconfig:"AWS_REGION" default:"ap-south-1"`
	AccessKeyID     string `envconfig:"AWS_ACCESS_KEY_ID"`
	SecretAccessKey string `envconfig:"AWS_SECRET_ACCESS_KEY"`
	BucketPrivate   string `envconfig:"S3_BUCKET_PRIVATE" default:"puneflats-private"`
	BucketPublic    string `envconfig:"S3_BUCKET_PUBLIC" default:"puneflats-public"`
}

// FeatureFlags controls runtime feature toggles.
type FeatureFlags struct {
	EnablePremiumAlerts  bool    `envconfig:"ENABLE_PREMIUM_ALERTS" default:"true"`
	EnableImageScrubbing bool    `envconfig:"ENABLE_IMAGE_SCRUBBING" default:"true"`
	EnableHeatmap        bool    `envconfig:"ENABLE_HEATMAP" default:"true"`
	MaxBBoxAreaKM2       float64 `envconfig:"MAX_BBOX_AREA_KM2" default:"25"`
	RateLimitMapPerMin   int     `envconfig:"RATE_LIMIT_MAP_QUERIES_PER_MIN" default:"60"`
	RateLimitPinPerMin   int     `envconfig:"RATE_LIMIT_PIN_CREATE_PER_MIN" default:"10"`
}

// Load reads all environment variables and returns a populated Config.
// Returns an error if any required variable is missing.
func Load() (*Config, error) {
	var cfg Config

	if err := envconfig.Process("", &cfg.Database); err != nil {
		return nil, fmt.Errorf("loading database config: %w", err)
	}
	if err := envconfig.Process("", &cfg.API); err != nil {
		return nil, fmt.Errorf("loading api config: %w", err)
	}
	if err := envconfig.Process("", &cfg.JWT); err != nil {
		return nil, fmt.Errorf("loading jwt config: %w", err)
	}
	if err := envconfig.Process("", &cfg.OTP); err != nil {
		return nil, fmt.Errorf("loading otp config: %w", err)
	}
	if err := envconfig.Process("", &cfg.S3); err != nil {
		return nil, fmt.Errorf("loading s3 config: %w", err)
	}
	if err := envconfig.Process("", &cfg.Features); err != nil {
		return nil, fmt.Errorf("loading feature flags: %w", err)
	}

	return &cfg, nil
}
