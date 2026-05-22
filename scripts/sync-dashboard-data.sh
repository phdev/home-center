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

echo "Copying to public/data for TV dashboard..."
mkdir -p "$ROOT_DIR/public/data"
cp "$ROOT_DIR/openclaw/logs/dashboard-state.json" "$ROOT_DIR/public/data/model-health.json"
cp "$DATA_DIR/routing-history.json" "$ROOT_DIR/public/data/routing-history.json"
cp "$DATA_DIR/cost-history.json" "$ROOT_DIR/public/data/cost-history.json"
cp "$DATA_DIR/task-metrics.json" "$ROOT_DIR/public/data/task-metrics.json"

echo "Generating performance seed data (if not present)..."
if [ ! -f "$DATA_DIR/wake-metrics.json" ] || [ ! -f "$DATA_DIR/task-metrics.json" ]; then
  node "$ROOT_DIR/scripts/generate-perf-seed-data.js"
fi

echo "Done! Data written to $DATA_DIR and public/data/"
ls -la "$DATA_DIR"
