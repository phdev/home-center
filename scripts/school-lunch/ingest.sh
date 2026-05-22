#!/usr/bin/env bash
#
# One-off ingestion for RBUSD elementary school lunch menus.
#
# Sources (PDFs live under https://4.files.edl.io/… and change monthly):
#   - April 2026: https://4.files.edl.io/efcf/04/13/26/170919-da55b06a-9604-47ca-bc8c-69b15f216d7f.pdf
#   - May   2026: https://4.files.edl.io/8cf1/04/13/26/170919-eeea9c90-bcaf-4ecb-97e5-c023452fc6ac.pdf
#
# When a new month's menu lands, download the PDFs, extend the JSON blob
# in this folder (or create a new one), and re-run this script. Until a
# scheduled worker takes over ingestion, this stays a manual monthly job.
#
# See docs/home_center_decisions_log.md → "Worker-backed persistence"
# and the TODO block under /api/school-lunch in worker/src/index.js.

set -euo pipefail

PAYLOAD="${1:-$(cd "$(dirname "$0")" && pwd)/2026-04-and-05.json}"
NAMESPACE_ID="28bb129564cc4c7fb1a4eafc26d73882"  # NOTIFICATIONS KV
KEY="hc:school-lunch:menu"

if [ ! -f "$PAYLOAD" ]; then
  echo "Missing payload: $PAYLOAD" >&2
  exit 1
fi

echo "→ Uploading $(basename "$PAYLOAD") to KV key $KEY"
cd "$(dirname "$0")/../../worker"
npx wrangler kv key put --namespace-id "$NAMESPACE_ID" "$KEY" --path "$PAYLOAD"

echo "→ Verifying"
curl -s https://home-center-api.phhowell.workers.dev/api/school-lunch \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'  {len(d.get(\"days\",[]))} days loaded')"
