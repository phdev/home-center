#!/bin/bash
# Deploy accel-driv-proxy to Cloudflare Workers via API
# Run: bash deploy-worker.sh
set -e

CF_TOKEN="Wk6MoCA1xDk3VWqs16gDjo1_Q_ShfFKR3r4GG1uh"
WORKER_NAME="accel-driv-proxy"

echo "=== Deploying $WORKER_NAME to Cloudflare Workers ==="
echo ""

# 1. Get account ID
echo "[1/4] Looking up Cloudflare account ID..."
ACCT_RESP=$(curl -s -H "Authorization: Bearer $CF_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts?page=1&per_page=5")

ACCT_ID=$(echo "$ACCT_RESP" | python3 -c "import sys,json; r=json.load(sys.stdin); print(r['result'][0]['id'])" 2>/dev/null)
if [ -z "$ACCT_ID" ]; then
  echo "ERROR: Could not get account ID. Response:"
  echo "$ACCT_RESP" | python3 -m json.tool 2>/dev/null || echo "$ACCT_RESP"
  exit 1
fi
echo "  Account ID: $ACCT_ID"

# 2. Upload worker script
echo "[2/4] Uploading worker script..."

# Worker source (embedded)
WORKER_JS=$(cat <<'WORKEREOF'
const API_ROUTES = {
  '/runway/': {
    target: 'https://api.dev.runwayml.com/v1/',
    authFn: function(env) {
      return {
        'Authorization': 'Bearer ' + env.RUNWAY_KEY,
        'X-Runway-Version': '2024-11-06'
      };
    }
  },
  '/marble/': {
    target: 'https://api.worldlabs.ai/marble/v1/',
    authFn: function(env) {
      return { 'WLT-Api-Key': env.MARBLE_KEY };
    }
  },
  '/decart/': {
    target: 'https://api.decart.ai/v1/',
    authFn: function(env) {
      return { 'X-API-KEY': env.DECART_KEY };
    }
  },
  '/kiri/': {
    target: 'https://api.kiriengine.app/api/',
    authFn: function(env) {
      return { 'Authorization': 'Bearer ' + env.KIRI_API_KEY };
    }
  },
  '/runpod/': {
    target: 'https://rest.runpod.io/v1/',
    authFn: function(env) {
      return { 'Authorization': 'Bearer ' + env.RUNPOD_KEY };
    }
  },
  '/runpod-sls/': {
    target: 'https://api.runpod.ai/v2/',
    authFn: function(env) {
      return { 'Authorization': 'Bearer ' + env.RUNPOD_KEY };
    }
  },
  '/runpod-gql': {
    target: 'https://api.runpod.io/graphql',
    authFn: function(env) {
      return { 'Authorization': 'Bearer ' + env.RUNPOD_KEY };
    }
  }
};

var STRIP_HEADERS = [
  'host', 'origin', 'referer',
  'cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'cf-visitor',
  'x-forwarded-for', 'x-forwarded-proto', 'x-real-ip',
  'connection', 'keep-alive'
];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': '*',
    'Access-Control-Max-Age': '86400'
  };
}

export default {
  async fetch(request, env) {
    var origin = request.headers.get('Origin') || '*';
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    var url = new URL(request.url);
    var path = url.pathname;
    if (path === '/health') {
      return new Response(JSON.stringify({ ok: true, routes: Object.keys(API_ROUTES) }), {
        headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders(origin))
      });
    }
    var targetUrl = null;
    var authHeaders = {};
    var prefixes = Object.keys(API_ROUTES);
    for (var i = 0; i < prefixes.length; i++) {
      var prefix = prefixes[i];
      if (path.indexOf(prefix) === 0) {
        var route = API_ROUTES[prefix];
        targetUrl = route.target + path.slice(prefix.length) + url.search;
        authHeaders = route.authFn(env);
        var authVals = Object.values(authHeaders);
        for (var v = 0; v < authVals.length; v++) {
          if (!authVals[v] || authVals[v].indexOf('undefined') !== -1) {
            return new Response(JSON.stringify({ error: 'API key not configured for ' + prefix }), {
              status: 500,
              headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders(origin))
            });
          }
        }
        break;
      }
    }
    if (!targetUrl && path === '/fetch') {
      var fetchUrl = url.searchParams.get('url');
      if (!fetchUrl) {
        return new Response('Missing url param', { status: 400, headers: corsHeaders(origin) });
      }
      targetUrl = fetchUrl;
    }
    if (!targetUrl) {
      return new Response('Not found', { status: 404, headers: corsHeaders(origin) });
    }
    var headers = new Headers();
    for (var entry of request.headers.entries()) {
      if (STRIP_HEADERS.indexOf(entry[0].toLowerCase()) === -1) {
        headers.set(entry[0], entry[1]);
      }
    }
    var authKeys = Object.keys(authHeaders);
    for (var j = 0; j < authKeys.length; j++) {
      headers.set(authKeys[j], authHeaders[authKeys[j]]);
    }
    try {
      var resp = await fetch(targetUrl, {
        method: request.method,
        headers: headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined
      });
      var respHeaders = new Headers(resp.headers);
      var cors = corsHeaders(origin);
      var corsKeys = Object.keys(cors);
      for (var c = 0; c < corsKeys.length; c++) {
        respHeaders.set(corsKeys[c], cors[corsKeys[c]]);
      }
      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: respHeaders
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 502,
        headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders(origin))
      });
    }
  }
};
WORKEREOF
)

# Create temp file for multipart upload
TMPDIR=$(mktemp -d)
METADATA='{"main_module":"worker.js","compatibility_date":"2024-01-01"}'
echo "$METADATA" > "$TMPDIR/metadata.json"
echo "$WORKER_JS" > "$TMPDIR/worker.js"

UPLOAD_RESP=$(curl -s -X PUT \
  -H "Authorization: Bearer $CF_TOKEN" \
  -F "metadata=@$TMPDIR/metadata.json;type=application/json" \
  -F "worker.js=@$TMPDIR/worker.js;type=application/javascript+module" \
  "https://api.cloudflare.com/client/v4/accounts/$ACCT_ID/workers/scripts/$WORKER_NAME")

rm -rf "$TMPDIR"

SUCCESS=$(echo "$UPLOAD_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
if [ "$SUCCESS" != "True" ]; then
  echo "ERROR: Worker upload failed. Response:"
  echo "$UPLOAD_RESP" | python3 -m json.tool 2>/dev/null || echo "$UPLOAD_RESP"
  exit 1
fi
echo "  Worker script uploaded!"

# 3. Enable workers.dev route
echo "[3/4] Enabling workers.dev subdomain..."
SUBDOMAIN_RESP=$(curl -s -X POST \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled":true}' \
  "https://api.cloudflare.com/client/v4/accounts/$ACCT_ID/workers/scripts/$WORKER_NAME/subdomain")
echo "  Done."

# 4. Add secrets
echo "[4/4] Adding API key secrets..."
echo ""

add_secret() {
  local name=$1
  local prompt=$2
  local required=$3

  read -p "$prompt" value
  if [ -z "$value" ]; then
    if [ "$required" = "yes" ]; then
      echo "  WARNING: $name is required for serverless splat conversion!"
    else
      echo "  Skipped $name"
    fi
    return
  fi

  SECRET_RESP=$(curl -s -X PUT \
    -H "Authorization: Bearer $CF_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"value\":\"$value\",\"type\":\"secret_text\"}" \
    "https://api.cloudflare.com/client/v4/accounts/$ACCT_ID/workers/scripts/$WORKER_NAME/secrets/$name")

  SEC_OK=$(echo "$SECRET_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null)
  if [ "$SEC_OK" = "True" ]; then
    echo "  $name set!"
  else
    echo "  WARNING: Failed to set $name"
    echo "$SECRET_RESP" | python3 -m json.tool 2>/dev/null || echo "$SECRET_RESP"
  fi
}

add_secret "RUNPOD_KEY"   "RunPod API key (rpa_...): " "yes"
add_secret "MARBLE_KEY"   "World Labs Marble key (press Enter to skip): " "no"
add_secret "RUNWAY_KEY"   "Runway key (press Enter to skip): " "no"
add_secret "DECART_KEY"   "Decart key (press Enter to skip): " "no"
add_secret "KIRI_API_KEY" "Kiri Engine key (press Enter to skip): " "no"

# Get the subdomain
echo ""
echo "=== Getting worker URL ==="
SD_RESP=$(curl -s -H "Authorization: Bearer $CF_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$ACCT_ID/workers/subdomain")
SUBDOMAIN=$(echo "$SD_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['subdomain'])" 2>/dev/null)
WORKER_URL="https://$WORKER_NAME.$SUBDOMAIN.workers.dev"

echo ""
echo "=== DEPLOYED! ==="
echo "Worker URL: $WORKER_URL"
echo ""
echo "Test it:  curl $WORKER_URL/health"
echo ""
echo "Use in editor:  https://phdev.github.io/accel-driv/?proxy=$WORKER_URL"
