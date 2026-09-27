# ===========================================================================
# Go API — Multi-stage Dockerfile
# ===========================================================================
# Targets:
#   development  — Air hot-reload, volume-mounted source
#   production   — Minimal Alpine binary, no dev tools
# ===========================================================================

# ---------------------------------------------------------------------------
# Stage: development
# ---------------------------------------------------------------------------
FROM golang:1.22-alpine AS development

# Install git (for go get) and build tools
RUN apk add --no-cache git build-base

# Install Air for hot reload
RUN go install github.com/air-verse/air@v1.52.3

WORKDIR /app

# Copy dependency files first (Docker layer caching)
COPY go.mod go.sum ./
RUN go mod download

# Copy source (overridden by volume mount in docker-compose)
COPY . .

EXPOSE 8080

# Air watches for file changes and rebuilds
CMD ["air", "-c", ".air.toml"]

# ---------------------------------------------------------------------------
# Stage: builder (for production)
# ---------------------------------------------------------------------------
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git build-base

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build static binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s" -o /bin/puneflats-api ./cmd/server

# ---------------------------------------------------------------------------
# Stage: production
# ---------------------------------------------------------------------------
FROM alpine:3.19 AS production

RUN apk add --no-cache ca-certificates tzdata

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy binary from builder
COPY --from=builder /bin/puneflats-api .

# Copy migrations (needed at runtime for auto-migration)
COPY --from=builder /app/migrations ./migrations

USER appuser

EXPOSE 8080

ENTRYPOINT ["./puneflats-api"]
