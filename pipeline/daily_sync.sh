#!/usr/bin/env bash
# ==============================================================================
# Daily Automated Property Ingestion & Transit Sync Script
# Runs every day to sync societies, commute lines, and property inventory
# across Pune, Mumbai, Gurgaon, and Noida.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$SCRIPT_DIR/logs"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
LOG_FILE="$LOG_DIR/daily_sync_${TIMESTAMP}.log"

mkdir -p "$LOG_DIR"

echo "==========================================================" | tee -a "$LOG_FILE"
echo "  PUNE-FLATS DAILY INGESTION & SYNC CRON RUN" | tee -a "$LOG_FILE"
echo "  Timestamp: $TIMESTAMP" | tee -a "$LOG_FILE"
echo "==========================================================" | tee -a "$LOG_FILE"

cd "$PROJECT_ROOT"

# Ensure python3 runs with unbuffered output
export PYTHONUNBUFFERED=1

# Execute automated sync across all metro cities with database integrity audit
if python3 pipeline/auto_sync_daemon.py --run-once --all 2>&1 | tee -a "$LOG_FILE"; then
    echo "✓ [$(date +%T)] Daily sync completed successfully." | tee -a "$LOG_FILE"
else
    echo "✗ [$(date +%T)] Daily sync encountered an error. Check $LOG_FILE" | tee -a "$LOG_FILE"
    exit 1
fi
