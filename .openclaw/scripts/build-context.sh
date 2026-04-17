#!/usr/bin/env bash
set -euo pipefail

# Generates .openclaw/context/module-map.md from the current codebase.
# Run daily or before spawning agents to keep context fresh.

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$REPO_ROOT/.openclaw/context/module-map.md"

mkdir -p "$(dirname "$OUT")"
cd "$REPO_ROOT"

cat > "$OUT" << 'HEADER'
# Home Center Module Map

Auto-generated — do not edit manually.
Run `.openclaw/scripts/build-context.sh` to regenerate.

HEADER

# Components
echo "## Components (src/components/)" >> "$OUT"
echo "" >> "$OUT"
for f in src/components/*.jsx; do
  [ -f "$f" ] || continue
  name=$(basename "$f" .jsx)
  # Get export function name
  export_line=$(grep -m1 'export.*function' "$f" 2>/dev/null | sed 's/^[[:space:]]*//' || echo "")
  echo "- **$name** — \`$f\`" >> "$OUT"
done
echo "" >> "$OUT"

# Hooks
echo "## Hooks (src/hooks/)" >> "$OUT"
echo "" >> "$OUT"
for f in src/hooks/*.js; do
  [ -f "$f" ] || continue
  name=$(basename "$f" .js)
  echo "- **$name** — \`$f\`" >> "$OUT"
done
echo "" >> "$OUT"

# Worker endpoints
echo "## Worker Endpoints (worker/src/index.js)" >> "$OUT"
echo "" >> "$OUT"
if [ -f "worker/src/index.js" ]; then
  grep -oE 'path === "[^"]*"' worker/src/index.js 2>/dev/null | \
    sed 's/path === "\(.*\)"/- `\1`/' | \
    sort -u >> "$OUT" || echo "- (could not parse endpoints)" >> "$OUT"
fi
echo "" >> "$OUT"

# Pi services
echo "## Pi Services" >> "$OUT"
echo "" >> "$OUT"
echo "- **wake-word** — \`pi/wake_word_service.py\` (openWakeWord + Whisper voice commands)" >> "$OUT"
echo "- **openclaw** — \`openclaw/index.js\` (Telegram bridge, port 3100, Mac Mini)" >> "$OUT"
echo "- **email-triage** — \`email-triage/\` (email classification + notifications)" >> "$OUT"
echo "- **school-updates** — \`school-updates/\` (Gmail school email summarizer)" >> "$OUT"
echo "" >> "$OUT"

# Themes
echo "## Themes (src/themes/)" >> "$OUT"
echo "" >> "$OUT"
if [ -d "src/themes" ]; then
  for f in src/themes/*.js; do
    [ -f "$f" ] || continue
    name=$(basename "$f" .js)
    echo "- **$name** — \`$f\`" >> "$OUT"
  done
fi
echo "" >> "$OUT"

# Data files
echo "## Data & Config" >> "$OUT"
echo "" >> "$OUT"
echo "- \`src/data/mockData.js\` — static data (facts, etc.)" >> "$OUT"
echo "- \`src/design/pen-spec.js\` — Pencil design node mapping" >> "$OUT"
echo "- \`vite.config.js\` — Vite config (base: /home-center/)" >> "$OUT"
echo "- \`worker/wrangler.toml\` — Cloudflare Worker config" >> "$OUT"

echo ""
echo "Module map generated: $OUT"
