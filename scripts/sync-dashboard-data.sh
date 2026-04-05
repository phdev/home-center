#!/bin/bash
# Sync router logs into dashboard-consumable JSON files
# Run manually or via cron, then git commit + push
# Usage: bash scripts/sync-dashboard-data.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="$ROOT_DIR/docs/dashboard/data"

mkdir -p "$DATA_DIR"

echo "Generating eval report..."
node "$ROOT_DIR/openclaw/eval/report.js" > "$DATA_DIR/eval-latest.json"

echo "Generating routing history..."
node "$ROOT_DIR/scripts/aggregate-logs.js" > "$DATA_DIR/routing-history.json"

echo "Generating cost history..."
node "$ROOT_DIR/scripts/aggregate-logs.js" --costs > "$DATA_DIR/cost-history.json"

echo "Copying current dashboard state..."
cp "$ROOT_DIR/openclaw/logs/dashboard-state.json" "$DATA_DIR/current-state.json"

echo "Done! Data written to $DATA_DIR"
ls -la "$DATA_DIR"
