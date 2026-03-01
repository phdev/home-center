// Cloudflare Worker proxy for Accel Driv
// Holds API keys server-side so they never reach the browser.
//
// Setup:
//   1. Install Wrangler:  npm install -g wrangler
//   2. Authenticate:      wrangler login
//   3. Deploy:            cd worker && wrangler deploy
//   4. Add your API keys as encrypted secrets:
//        wrangler secret put RUNWAY_KEY
//        wrangler secret put MARBLE_KEY
//        wrangler secret put DECART_KEY
//        wrangler secret put KIRI_API_KEY
//        wrangler secret put MODAL_URL    (e.g. https://phdev--accel-driv-3dgs-web.modal.run)
//
// Then set the Worker URL in the editor (one-time):
//   https://phdev.github.io/accel-driv/?proxy=https://accel-driv-proxy.<you>.workers.dev
//
// Routes:
//   /runway/*  -> https://api.dev.runwayml.com/v1/*  (adds Authorization + X-Runway-Version)
//   /marble/*  -> https://api.worldlabs.ai/marble/v1/*  (adds WLT-Api-Key)
//   /decart/*  -> https://api.decart.ai/v1/*  (adds X-API-KEY)
//   /kiri/*    -> https://api.kiriengine.app/api/*  (adds Authorization: Bearer)
//   /modal/*   -> MODAL_URL/*  (Modal serverless 3DGS training)
//   /runpod-sls/*  -> https://api.runpod.ai/v2/*  (adds Authorization: Bearer, serverless API)
//   /runpod-gql    -> https://api.runpod.io/graphql  (adds Authorization: Bearer, template/endpoint mgmt)
//   /fetch?url=<encoded>  -> generic CORS proxy (no auth added)
//   /health    -> health check

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
  '/modal/': {
    target: null, // set dynamically from env.MODAL_URL
    authFn: function(env) { return {}; }
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

// Headers to strip when forwarding to upstream APIs
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

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    var url = new URL(request.url);
    var path = url.pathname;

    // Health check
    if (path === '/health') {
      return new Response(JSON.stringify({ ok: true, routes: Object.keys(API_ROUTES) }), {
        headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders(origin))
      });
    }

    // Find matching API route
    var targetUrl = null;
    var authHeaders = {};
    var prefixes = Object.keys(API_ROUTES);
    for (var i = 0; i < prefixes.length; i++) {
      var prefix = prefixes[i];
      if (path.indexOf(prefix) === 0) {
        var route = API_ROUTES[prefix];
        // Modal route: target URL comes from env.MODAL_URL
        var routeTarget = route.target;
        if (prefix === '/modal/' && env.MODAL_URL) {
          routeTarget = env.MODAL_URL.replace(/\/$/, '') + '/';
        }
        if (!routeTarget) {
          return new Response(JSON.stringify({ error: 'MODAL_URL not configured — run: wrangler secret put MODAL_URL' }), {
            status: 500,
            headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders(origin))
          });
        }
        targetUrl = routeTarget + path.slice(prefix.length) + url.search;
        authHeaders = route.authFn(env);
        // Guard: check that all auth values are actually set
        var authVals = Object.values(authHeaders);
        for (var v = 0; v < authVals.length; v++) {
          if (!authVals[v] || authVals[v].indexOf('undefined') !== -1) {
            return new Response(JSON.stringify({ error: 'API key not configured for ' + prefix + ' — run wrangler secret put' }), {
              status: 500,
              headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders(origin))
            });
          }
        }
        break;
      }
    }

    // Generic fetch proxy (for CORS bypass on CDN URLs, presigned uploads, etc.)
    if (!targetUrl && path === '/fetch') {
      var fetchUrl = url.searchParams.get('url');
      if (!fetchUrl) {
        return new Response('Missing url param', {
          status: 400,
          headers: corsHeaders(origin)
        });
      }
      targetUrl = fetchUrl;
    }

    if (!targetUrl) {
      return new Response('Not found', { status: 404, headers: corsHeaders(origin) });
    }

    // Build upstream request headers: forward client headers minus internal ones
    var headers = new Headers();
    for (var entry of request.headers.entries()) {
      if (STRIP_HEADERS.indexOf(entry[0].toLowerCase()) === -1) {
        headers.set(entry[0], entry[1]);
      }
    }
    // Apply auth headers (override any client-sent ones)
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

      // Return response with CORS headers
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
