#!/bin/bash
# setup-cron.sh — Installs the crawler as a Linux cron job
# Usage: bash scripts/setup-cron.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
NODE_BIN="$(which node)"
LOG_DIR="$PROJECT_DIR/data/logs"

mkdir -p "$LOG_DIR"

CRON_JOB="0 0 * * * $NODE_BIN $PROJECT_DIR/scripts/run-crawl.js >> $LOG_DIR/cron.log 2>&1"

echo "Installing cron job:"
echo "  $CRON_JOB"
echo ""

# Add to crontab (preserving existing entries)
(crontab -l 2>/dev/null | grep -v "run-crawl.js"; echo "$CRON_JOB") | crontab -

echo "✅ Cron job installed! Runs every day at midnight."
echo ""
echo "To verify:"
echo "  crontab -l"
echo ""
echo "To remove:"
echo "  crontab -l | grep -v 'run-crawl.js' | crontab -"
echo ""
echo "To test immediately:"
echo "  node $PROJECT_DIR/scripts/run-crawl.js"
