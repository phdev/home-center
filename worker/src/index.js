export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return corsResponse(env, new Response(null, { status: 204 }));
    }

    // Auth check — if AUTH_TOKEN is configured, require it on every request
    // (except /api/health which is always open for diagnostics)
    if (env.AUTH_TOKEN && path !== "/api/health") {
      const auth = request.headers.get("Authorization");
      if (!auth) {
        return corsResponse(env, json({
          error: "Unauthorized — no token sent. Set the Auth Token in Settings to match your worker's AUTH_TOKEN secret.",
        }, 401));
      }
      if (auth !== `Bearer ${env.AUTH_TOKEN}`) {
        return corsResponse(env, json({
          error: "Unauthorized — token mismatch. The Auth Token in Settings does not match the AUTH_TOKEN secret on your worker.",
        }, 401));
      }
    }

    try {
      if (path === "/api/ask" && request.method === "POST") {
        return corsResponse(env, await handleAsk(request, env));
      }
      if (path === "/api/calendar") {
        return corsResponse(env, await handleCalendar(env, url));
      }
      if (path === "/api/birthdays") {
        return corsResponse(env, await handleBirthdays(env));
      }
      if (path === "/api/school-updates" && request.method === "POST") {
        return corsResponse(env, await handleSchoolUpdatesPost(request, env));
      }
      if (path === "/api/school-updates" && request.method === "GET") {
        return corsResponse(env, await handleSchoolUpdatesGet(env));
      }
      if (path === "/api/photos") {
        return corsResponse(env, await handlePhotos(env));
      }
      if (path === "/api/notifications" && request.method === "POST") {
        return corsResponse(env, await handleNotificationPost(request, env));
      }
      if (path === "/api/notifications" && request.method === "GET") {
        return corsResponse(env, await handleNotificationGet(env));
      }
      if (path.startsWith("/api/notifications/") && request.method === "DELETE") {
        const id = decodeURIComponent(path.split("/api/notifications/")[1]);
        return corsResponse(env, await handleNotificationDelete(id, env));
      }
      // ── LLM Query (classified knowledge queries) ──
      if (path === "/api/ask-query" && request.method === "POST") {
        return corsResponse(env, await handleAskQuery(request, env));
      }
      if (path === "/api/llm/latest" && request.method === "GET") {
        return corsResponse(env, await handleLLMLatest(env));
      }
      if (path === "/api/llm/history" && request.method === "GET") {
        return corsResponse(env, await handleLLMHistory(env));
      }
      if (path === "/api/llm/dismiss" && request.method === "POST") {
        return corsResponse(env, await handleLLMDismiss(request, env));
      }
      // ── Navigation (voice-controlled page switching) ──
      if (path === "/api/navigate" && request.method === "POST") {
        return corsResponse(env, await handleNavigatePost(request, env));
      }
      if (path === "/api/navigate" && request.method === "GET") {
        return corsResponse(env, await handleNavigateGet(env));
      }
      // ── Gesture (HandController fast-poll) ──
      if (path === "/api/gesture" && request.method === "GET") {
        return corsResponse(env, await handleGestureGet(env));
      }
      // ── Wake Word Debug ──
      if (path === "/api/wake-debug" && request.method === "POST") {
        return corsResponse(env, await handleWakeDebugPost(request, env));
      }
      if (path === "/api/wake-debug" && request.method === "GET") {
        return corsResponse(env, await handleWakeDebugGet(env, url));
      }
      // ── Wake Word Config ──
      if (path === "/api/wake-config" && request.method === "GET") {
        return corsResponse(env, await handleWakeConfigGet(env));
      }
      if (path === "/api/wake-config" && request.method === "PUT") {
        return corsResponse(env, await handleWakeConfigPut(request, env));
      }
      // ── Wake Record (voice sample recording for training) ──
      if (path === "/api/wake-record" && request.method === "GET") {
        return corsResponse(env, await handleWakeRecordGet(env));
      }
      if (path === "/api/wake-record" && request.method === "POST") {
        return corsResponse(env, await handleWakeRecordPost(request, env));
      }
      // ── Timers ──
      if (path === "/api/timers" && request.method === "POST") {
        return corsResponse(env, await handleTimerPost(request, env));
      }
      if (path === "/api/timers" && request.method === "GET") {
        return corsResponse(env, await handleTimerGet(env));
      }
      if (path === "/api/timers/dismiss-all" && request.method === "POST") {
        return corsResponse(env, await handleTimerDismissAll(env));
      }
      if (path.startsWith("/api/timers/") && path.endsWith("/dismiss") && request.method === "POST") {
        const id = decodeURIComponent(path.split("/api/timers/")[1].replace("/dismiss", ""));
        return corsResponse(env, await handleTimerDismiss(id, env));
      }
      // ── Agent Tasks (OpenClaw) ──
      if (path === "/api/tasks" && request.method === "GET") {
        return corsResponse(env, await handleTaskGet(env));
      }
      if (path === "/api/tasks" && request.method === "POST") {
        return corsResponse(env, await handleTaskPost(request, env));
      }
      if (path.startsWith("/api/tasks/") && path.endsWith("/complete") && request.method === "POST") {
        const id = decodeURIComponent(path.split("/api/tasks/")[1].replace("/complete", ""));
        return corsResponse(env, await handleTaskComplete(id, request, env));
      }
      if (path.startsWith("/api/tasks/") && request.method === "DELETE") {
        const id = decodeURIComponent(path.split("/api/tasks/")[1]);
        return corsResponse(env, await handleTaskDelete(id, env));
      }
      // ── Takeout (tonight's dinner decision) ──
      if (path === "/api/takeout/today" && request.method === "GET") {
        return corsResponse(env, await handleTakeoutGet(env));
      }
      if (path === "/api/takeout/today" && request.method === "POST") {
        return corsResponse(env, await handleTakeoutPost(request, env));
      }
      // ── Lunch decisions per date ──
      if (path === "/api/lunch/decisions" && request.method === "GET") {
        return corsResponse(env, await handleLunchGet(env));
      }
      if (path === "/api/lunch/decisions" && request.method === "POST") {
        return corsResponse(env, await handleLunchPost(request, env));
      }
      // ── School lunch menu (read-only; ingestion is a separate task) ──
      if (path === "/api/school-lunch" && request.method === "GET") {
        return corsResponse(env, await handleSchoolLunchGet(env));
      }
      // ── Birthday gift-status overrides ──
      if (path.startsWith("/api/birthdays/") && request.method === "PATCH") {
        const id = decodeURIComponent(path.split("/api/birthdays/")[1]);
        return corsResponse(env, await handleBirthdayPatch(id, request, env));
      }
      // ── OpenClaw enhancement (copy, summaries, suggestions) ──
      if (path === "/api/claw/enhance" && request.method === "POST") {
        return corsResponse(env, await handleClawEnhance(request, env));
      }
      if (path === "/api/health") {
        // Auth status: check if a valid token was provided (but don't block)
        const auth = request.headers.get("Authorization");
        let authStatus = "no AUTH_TOKEN configured (open access)";
        if (env.AUTH_TOKEN) {
          if (!auth) authStatus = "AUTH_TOKEN set but no token sent — requests will fail";
          else if (auth === `Bearer ${env.AUTH_TOKEN}`) authStatus = "ok";
          else authStatus = "token mismatch — requests will fail";
        }
        return corsResponse(env, json({
          ok: true,
          auth: authStatus,
          hasAuthToken: !!env.AUTH_TOKEN,
          hasOpenAI: !!env.OPENAI_API_KEY,
          hasCalDAV: !!(env.ICLOUD_APPLE_ID && env.ICLOUD_APP_PASSWORD),
          hasCalendarUrls: !!(env.CALENDAR_URLS),
          hasPhotos: !!env.PHOTOS_ALBUM_TOKEN,
          hasNotifications: !!env.NOTIFICATIONS,
          openaiModel: env.OPENAI_MODEL || "gpt-4o-mini",
        }));
      }
      return corsResponse(env, json({ error: "Not found" }, 404));
    } catch (e) {
      return corsResponse(env, json({ error: e.message }, 500));
    }
  },
};

// ── Helpers ──────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function corsResponse(env, response) {
  const origin = env.ALLOWED_ORIGIN || "*";
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

// ── Ask (OpenAI proxy) ─────────────────────────────────────────────

async function handleAsk(request, env) {
  if (!env.OPENAI_API_KEY) {
    return json({ error: "OPENAI_API_KEY not configured" }, 500);
  }

  const body = await request.json();
  const { query, history = [] } = body;
  if (!query) return json({ error: "Missing query" }, 400);

  const model = env.OPENAI_MODEL || "gpt-4o-mini";
  const imageModel = env.OPENAI_IMAGE_MODEL || "dall-e-3";

  const systemMsg = {
    role: "system",
    content:
      "You are a helpful family home assistant. Keep answers concise, friendly, and family-appropriate. " +
      "When it would be helpful, describe a scene or concept visually. " +
      "If the user's question would benefit from an illustration, end your response with a line: " +
      "[IMAGE_PROMPT: <a detailed prompt for generating an illustrative image>]",
  };

  const messages = [
    systemMsg,
    ...history.map((m) => ({
      role: m.r === "u" ? "user" : "assistant",
      content: m.t,
    })),
    { role: "user", content: query },
  ];

  // Chat completion
  const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: 512 }),
  });

  if (!chatRes.ok) {
    const err = await chatRes.json().catch(() => ({}));
    return json({ error: err.error?.message || `OpenAI error: ${chatRes.status}` }, 502);
  }

  const chatData = await chatRes.json();
  let text = chatData.choices?.[0]?.message?.content || "No response.";
  let imageUrl = null;

  // Check if LLM wants to generate an image
  const imgMatch = text.match(/\[IMAGE_PROMPT:\s*(.+?)\]/);
  if (imgMatch) {
    text = text.replace(/\[IMAGE_PROMPT:\s*.+?\]/, "").trim();
    try {
      const imgRes = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: imageModel,
          prompt: imgMatch[1],
          n: 1,
          size: "1024x1024",
          quality: "standard",
        }),
      });
      if (imgRes.ok) {
        const imgData = await imgRes.json();
        imageUrl = imgData.data?.[0]?.url || null;
      }
    } catch {
      // Image generation failed silently
    }
  }

  return json({ text, imageUrl });
}

// ── LLM Query (classified knowledge) ────────────────────────────────

const LLM_LATEST_KEY = "llm_latest";
const LLM_HISTORY_KEY = "llm_history";
const MAX_LLM_HISTORY = 50;

async function handleAskQuery(request, env) {
  if (!env.OPENAI_API_KEY) {
    return json({ error: "OPENAI_API_KEY not configured" }, 500);
  }
  if (!env.NOTIFICATIONS) {
    return json({ error: "NOTIFICATIONS KV namespace not configured" }, 500);
  }

  const body = await request.json();
  const { query } = body;
  if (!query) return json({ error: "Missing query" }, 400);

  const model = env.OPENAI_MODEL || "gpt-4o-mini";
  const imageModel = env.OPENAI_IMAGE_MODEL || "dall-e-3";

  const systemMsg = {
    role: "system",
    content: `You are a family knowledge assistant for a TV dashboard. Given a question, classify it and respond with valid JSON only (no markdown fencing).

Response format:
{
  "type": "location" | "person" | "fauna" | "flora" | "event" | "concept",
  "title": "Short title (2-5 words)",
  "summary": "2-3 sentence overview",
  "sections": [
    { "heading": "Section Name", "content": "A paragraph of information..." },
    ...3-4 sections
  ],
  "infographic": {
    "type": "stats",
    "items": [
      { "label": "Key Stat", "value": "Value" },
      ...3-5 items
    ]
  },
  "imagePrompt": "A detailed prompt for generating an illustrative image of the subject"
}

Type-specific sections to include:
- location: Overview, Geography, Culture, Fun Facts
- person: Biography, Achievements, Legacy, Fun Facts
- fauna: Description, Habitat, Diet, Fun Facts
- flora: Description, Growing Conditions, Uses, Fun Facts
- event: Overview, Timeline, Impact, Fun Facts
- concept: Explanation, History, Applications, Fun Facts

Keep all content family-friendly and concise. Each section should be 2-4 sentences.`,
  };

  const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [systemMsg, { role: "user", content: query }],
      max_tokens: 1024,
      response_format: { type: "json_object" },
    }),
  });

  if (!chatRes.ok) {
    const err = await chatRes.json().catch(() => ({}));
    return json({ error: err.error?.message || `OpenAI error: ${chatRes.status}` }, 502);
  }

  const chatData = await chatRes.json();
  const rawText = chatData.choices?.[0]?.message?.content || "{}";

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return json({ error: "Failed to parse LLM response", raw: rawText }, 502);
  }

  // Generate image if imagePrompt was provided
  let imageUrl = null;
  if (parsed.imagePrompt) {
    try {
      const imgRes = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: imageModel,
          prompt: parsed.imagePrompt,
          n: 1,
          size: "1024x1024",
          quality: "standard",
        }),
      });
      if (imgRes.ok) {
        const imgData = await imgRes.json();
        imageUrl = imgData.data?.[0]?.url || null;
      }
    } catch {
      // Image generation failed silently
    }
  }

  const response = {
    id: `llm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    query,
    type: parsed.type || "concept",
    title: parsed.title || query,
    summary: parsed.summary || "",
    sections: parsed.sections || [],
    infographic: parsed.infographic || null,
    imageUrl,
    timestamp: Date.now(),
  };

  // Store as latest (for dashboard polling)
  await env.NOTIFICATIONS.put(LLM_LATEST_KEY, JSON.stringify(response));

  // Append to history (summary only, no full sections to save space)
  const history = await env.NOTIFICATIONS.get(LLM_HISTORY_KEY, { type: "json" }) || [];
  history.unshift({
    id: response.id,
    query: response.query,
    type: response.type,
    title: response.title,
    summary: response.summary,
    imageUrl: response.imageUrl,
    timestamp: response.timestamp,
  });
  await env.NOTIFICATIONS.put(LLM_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_LLM_HISTORY)));

  return json(response);
}

async function handleLLMLatest(env) {
  if (!env.NOTIFICATIONS) return json({ response: null });
  const raw = await env.NOTIFICATIONS.get(LLM_LATEST_KEY);
  if (!raw) return json({ response: null });
  return json({ response: JSON.parse(raw) });
}

async function handleLLMHistory(env) {
  if (!env.NOTIFICATIONS) return json({ history: [] });
  const history = await env.NOTIFICATIONS.get(LLM_HISTORY_KEY, { type: "json" }) || [];
  return json({ history });
}

async function handleLLMDismiss(request, env) {
  if (!env.NOTIFICATIONS) return json({ ok: false });
  await env.NOTIFICATIONS.delete(LLM_LATEST_KEY);
  return json({ ok: true });
}

// ── Calendar ────────────────────────────────────────────────────────

async function handleCalendar(env, url) {
  const debug = url?.searchParams?.get("debug") === "true";
  const hasCalDAV = !!(env.ICLOUD_APPLE_ID && env.ICLOUD_APP_PASSWORD);
  const hasUrls = !!(env.CALENDAR_URLS);
  if (!hasCalDAV && !hasUrls) {
    return json({
      error: "No calendar sources configured. Set ICLOUD_APPLE_ID + ICLOUD_APP_PASSWORD for CalDAV, or CALENDAR_URLS for iCal feeds (wrangler secret put).",
    }, 500);
  }

  const events = [];
  const errors = [];
  let debugInfo = null;

  // Try CalDAV (private iCloud calendars) first
  if (env.ICLOUD_APPLE_ID && env.ICLOUD_APP_PASSWORD) {
    try {
      const result = await fetchCalDAV(env.ICLOUD_APPLE_ID, env.ICLOUD_APP_PASSWORD, debug);
      events.push(...result.events);
      if (debug) debugInfo = result.diag;
    } catch (e) {
      console.error("CalDAV error:", e);
      errors.push(`CalDAV: ${e.message}`);
    }
  }

  // Also fetch any configured iCal URLs
  const icalNow = new Date();
  const icalStart = new Date(icalNow.getFullYear(), icalNow.getMonth(), icalNow.getDate());
  const icalEnd = new Date(icalStart.getTime() + 14 * 86400000);
  if (env.CALENDAR_URLS) {
    const urls = env.CALENDAR_URLS.split(",").map((u) => u.trim()).filter(Boolean);
    for (const url of urls) {
      try {
        const icsUrl = url.replace("webcal://", "https://");
        const res = await fetch(icsUrl);
        if (res.ok) {
          const text = await res.text();
          events.push(...parseIcalEvents(text, icalStart, icalEnd));
        }
      } catch (e) {
        console.error("iCal fetch error:", url, e);
      }
    }
  }

  // Sort by start time
  events.sort((a, b) => (a.startDate || 0) - (b.startDate || 0));

  return json({
    events: events.map(({ startDate, ...rest }) => ({ ...rest, start: startDate })),
    ...(errors.length > 0 && { errors }),
    ...(debug && debugInfo && { debug: debugInfo }),
  });
}

async function fetchCalDAV(appleId, appPassword, debug = false) {
  const auth = btoa(`${appleId}:${appPassword}`);
  const headers = {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/xml; charset=utf-8",
    Depth: "0",
  };
  const diag = {};

  // Step 1: Find principal URL
  const principalRes = await fetch("https://caldav.icloud.com/", {
    method: "PROPFIND",
    headers,
    body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:current-user-principal/></d:prop>
</d:propfind>`,
  });

  if (!principalRes.ok) {
    throw new Error(`CalDAV auth failed: ${principalRes.status}`);
  }

  const principalXml = await principalRes.text();
  const principalHref = extractHref(principalXml, "current-user-principal");
  if (!principalHref) throw new Error("Could not find principal URL");
  if (debug) diag.principalHref = principalHref;

  // Step 2: Find calendar home set
  // iCloud may redirect to a partition-specific host
  const homeUrl = principalHref.startsWith("http")
    ? principalHref
    : `https://caldav.icloud.com${principalHref}`;
  const homeRes = await fetch(homeUrl, {
    method: "PROPFIND",
    headers,
    body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><c:calendar-home-set/></d:prop>
</d:propfind>`,
  });

  const homeXml = await homeRes.text();
  const homeHref = extractHref(homeXml, "calendar-home-set");
  if (!homeHref) throw new Error("Could not find calendar home");
  if (debug) diag.homeHref = homeHref;

  // Step 3: List calendars
  // The home-set URL from iCloud is usually a full URL with the correct host
  const listUrl = homeHref.startsWith("http")
    ? homeHref
    : `https://caldav.icloud.com${homeHref}`;
  const listRes = await fetch(listUrl, {
    method: "PROPFIND",
    headers: { ...headers, Depth: "1" },
    body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">
  <d:prop>
    <d:displayname/>
    <d:resourcetype/>
    <cs:getctag/>
  </d:prop>
</d:propfind>`,
  });

  const listXml = await listRes.text();
  if (debug) diag.listStatus = listRes.status;
  const allCalendars = extractCalendarHrefs(listXml, homeHref);
  if (debug) diag.allCalendars = allCalendars;

  // Only use the "Howell Family" calendar (skip iPhone reminders etc.)
  const CALENDAR_FILTER = "Howell Family";
  const calendarHrefs = allCalendars.filter(
    (c) => c.name.toLowerCase() === CALENDAR_FILTER.toLowerCase()
  );
  if (debug) diag.filteredCalendars = calendarHrefs;

  // Fallback: if no match, use all real calendars (skip inbox/outbox/notification)
  const activeCals = calendarHrefs.length > 0
    ? calendarHrefs
    : allCalendars.filter((c) => !/(inbox|outbox|notification)/.test(c.href));

  // Step 4: Fetch events for the next 14 days from each calendar
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfWeek = new Date(startOfDay.getTime() + 14 * 86400000);
  const dtStart = toIcalDate(startOfDay);
  const dtEnd = toIcalDate(endOfWeek);
  if (debug) diag.dateRange = { dtStart, dtEnd, todayISO: today.toISOString() };

  const allEvents = [];

  for (const cal of activeCals) {
    try {
      const reportUrl = cal.href.startsWith("http")
        ? cal.href
        : `https://caldav.icloud.com${cal.href}`;
      const reportRes = await fetch(reportUrl, {
        method: "REPORT",
        headers: {
          ...headers,
          Depth: "1",
        },
        body: `<?xml version="1.0" encoding="utf-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${dtStart}" end="${dtEnd}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`,
      });

      if (debug) {
        diag[`report_${cal.name || cal.href.split("/").pop()}`] = {
          status: reportRes.status,
        };
      }

      if (reportRes.ok) {
        const reportXml = await reportRes.text();
        const icsBlocks = extractCalendarData(reportXml);
        if (debug) {
          diag[`report_${cal.name || cal.href.split("/").pop()}`].icsBlockCount = icsBlocks.length;
        }
        for (const ics of icsBlocks) {
          allEvents.push(...parseIcalEvents(ics, startOfDay, endOfWeek));
        }
      }
    } catch (e) {
      if (debug) diag[`error_${cal.href}`] = e.message;
    }
  }

  if (debug) diag.totalEvents = allEvents.length;
  return { events: allEvents, diag };
}

// ── Birthdays ────────────────────────────────────────────────────────

const BIRTHDAY_GIFTS_KEY = "hc:birthday:gifts";
const VALID_GIFT_STATUS = new Set(["ready", "ordered", "needed", "unknown"]);

async function handleBirthdays(env) {
  if (!env.ICLOUD_APPLE_ID || !env.ICLOUD_APP_PASSWORD) {
    return json({ error: "CalDAV not configured. Set ICLOUD_APPLE_ID + ICLOUD_APP_PASSWORD." }, 500);
  }

  try {
    const birthdays = await fetchBirthdays(env.ICLOUD_APPLE_ID, env.ICLOUD_APP_PASSWORD);
    const overrides = env.NOTIFICATIONS
      ? (await env.NOTIFICATIONS.get(BIRTHDAY_GIFTS_KEY, { type: "json" })) ?? {}
      : {};
    const merged = birthdays.map((b) => {
      const o = overrides[b.id ?? b.uid ?? b.name];
      if (!o) return b;
      return { ...b, giftStatus: o.giftStatus, giftNotes: o.giftNotes };
    });
    return json({ birthdays: merged });
  } catch (e) {
    return json({ error: `Birthdays: ${e.message}`, birthdays: [] }, 500);
  }
}

async function handleBirthdayPatch(id, request, env) {
  if (!env.NOTIFICATIONS) return json({ error: "KV not configured" }, 500);
  if (!id) return json({ error: "id required" }, 400);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { giftStatus, giftNotes } = body ?? {};
  if (!VALID_GIFT_STATUS.has(giftStatus)) {
    return json({ error: `giftStatus must be one of ${[...VALID_GIFT_STATUS].join(", ")}` }, 400);
  }
  if (giftNotes != null && typeof giftNotes !== "string") {
    return json({ error: "giftNotes must be a string" }, 400);
  }
  const overrides =
    (await env.NOTIFICATIONS.get(BIRTHDAY_GIFTS_KEY, { type: "json" })) ?? {};
  overrides[id] = {
    giftStatus,
    giftNotes: giftNotes ?? overrides[id]?.giftNotes ?? null,
    updatedAt: new Date().toISOString(),
  };
  await env.NOTIFICATIONS.put(BIRTHDAY_GIFTS_KEY, JSON.stringify(overrides));
  return json({ ok: true, id, override: overrides[id] });
}

// ── OpenClaw enhancement (copy, summaries, suggestions) ────────────
//
// Contract (see docs/home_center_decisions_log.md):
//   - OpenClaw enhances, it does not decide. The client must render
//     correctly with fields === {}.
//   - Every call is cached per (feature, stateHash) for 1 h to bound cost.
//   - Model ID is read from env.OPENAI_ENHANCE_MODEL with the safe default
//     below — never inlined elsewhere (see "model IDs never hardcoded"
//     decision, 2026-04-19).
//   - Failure modes (no OpenAI key, non-2xx, malformed JSON, unknown
//     feature) all return {fields: {}, error: "..."} and 200 OK. Client
//     treats any response with empty fields as "use deterministic fallback".

const CLAW_ENHANCE_CACHE_TTL = 3600;              // 1 h
const CLAW_ENHANCE_DEFAULT_MODEL = "gpt-5.5";

async function handleClawEnhance(request, env) {
  if (!env.OPENAI_API_KEY) {
    return json({ fields: {}, source: "fallback", error: "openai-not-configured" });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { feature, state } = body ?? {};
  const builder = CLAW_ENHANCERS[feature];
  if (!builder) {
    return json({ fields: {}, source: "fallback", error: `unknown-feature:${feature}` });
  }

  const cacheKey = await clawCacheKey(feature, state);

  // Cache hit
  if (env.NOTIFICATIONS) {
    const cached = await env.NOTIFICATIONS.get(cacheKey, { type: "json" });
    if (cached) {
      return json({ fields: cached, source: "cache" });
    }
  }

  const spec = builder(state ?? {});
  if (!spec) {
    return json({ fields: {}, source: "fallback", error: "empty-state" });
  }

  const model = env.OPENAI_ENHANCE_MODEL || CLAW_ENHANCE_DEFAULT_MODEL;

  let raw;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: spec.system },
          { role: "user", content: spec.user },
        ],
        response_format: { type: "json_object" },
        // GPT-5.x rejected `max_tokens`; use `max_completion_tokens`.
        // Temperature left at server default — newer reasoning-family
        // models reject non-default values.
        max_completion_tokens: 400,
      }),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      return json({
        fields: {},
        source: "fallback",
        error: `openai-${res.status}`,
        detail,
      });
    }
    const data = await res.json();
    raw = data.choices?.[0]?.message?.content;
  } catch (e) {
    return json({ fields: {}, source: "fallback", error: `openai-threw:${e.message}` });
  }

  if (!raw) {
    return json({ fields: {}, source: "fallback", error: "no-content" });
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json({ fields: {}, source: "fallback", error: "bad-json-from-model" });
  }

  const validated = spec.validate(parsed);

  if (env.NOTIFICATIONS) {
    await env.NOTIFICATIONS.put(cacheKey, JSON.stringify(validated), {
      expirationTtl: CLAW_ENHANCE_CACHE_TTL,
    });
  }

  return json({ fields: validated, source: "openclaw", model });
}

async function clawCacheKey(feature, state) {
  const buf = new TextEncoder().encode(
    `${feature}:${safeStringify(state)}`,
  );
  const hash = await crypto.subtle.digest("SHA-256", buf);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
  return `hc:claw:enhance:${feature}:${hex}`;
}

function safeStringify(v) {
  try {
    return JSON.stringify(v ?? null);
  } catch {
    return String(v);
  }
}

// Utilities used by enhancers
function clampStr(s, max) {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, max);
}
function asStringArray(v, maxLen, maxItems) {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => clampStr(String(x), maxLen))
    .filter((x) => x.length > 0)
    .slice(0, maxItems);
}

// ── Per-feature prompt builders ────────────────────────────────────

const CLAW_ENHANCERS = {
  // Morning checklist intro
  // state:  { variant: {highTempF, needsJacket, hotDay, rain}, items: [...] }
  // output: { intro: string (≤100 chars) }
  morningChecklist(state) {
    const v = state?.variant ?? {};
    return {
      system:
        'You write ONE short, warm, slightly varied line of copy for a family TV dashboard checklist shown to kids heading to school. Max 100 characters. Casual tone, not robotic. Never scold. Respond with strict JSON: {"intro": "..."}.',
      user: `Today's weather: highTempF=${v.highTempF ?? "?"}, needsJacket=${!!v.needsJacket}, hotDay=${!!v.hotDay}, rain=${!!v.rain}. Write a single "before you head out" opener for the checklist.`,
      validate: (fields) => ({ intro: clampStr(fields?.intro, 140) }),
    };
  },

  // Bedtime toast softener
  // state:  { bedtimeAt, minutesUntil, kidsInRange: [{childId, childName}] }
  // output: { copy: string (≤160 chars) }
  bedtime(state) {
    const kids = (state?.kidsInRange ?? []).map((k) => k.childName).filter(Boolean).join(" & ");
    const mins = state?.minutesUntil ?? 30;
    return {
      system:
        'You write ONE gentle bedtime-approaching reminder for a family TV dashboard. Max 160 characters. Soft, contextual, never scolding. No emojis. Respond with strict JSON: {"copy": "..."}.',
      user: `Bedtime for ${kids || "the kids"} is in ${mins} minutes. Write a single line that nudges them to start winding down.`,
      validate: (fields) => ({ copy: clampStr(fields?.copy, 200) }),
    };
  },

  // Takeout decision suggestions
  // state:  { decision, vendor?, suggestedVendors: string[] }
  // output: { intro: string, topPicks: [{name, reason}] (≤2) }
  takeout(state) {
    const vendors = Array.isArray(state?.suggestedVendors) ? state.suggestedVendors : [];
    return {
      system:
        'You help a family decide on dinner takeout. Pick TWO vendors from the provided list and give each a one-phrase reason. Write one short intro line (≤120 chars). No emojis. Respond with strict JSON: {"intro":"...","topPicks":[{"name":"...","reason":"..."},{"name":"...","reason":"..."}]}. The "name" field must be exactly as provided in the input list.',
      user: `It's past 4:30 PM and no dinner decision has been made. Rotation suggests: ${vendors.join(", ")}. Pick the two you'd lean toward and explain briefly.`,
      validate: (fields) => {
        const validNames = new Set(vendors);
        const picks = Array.isArray(fields?.topPicks) ? fields.topPicks : [];
        return {
          intro: clampStr(fields?.intro, 140),
          topPicks: picks
            .filter((p) => p && validNames.has(p.name))
            .slice(0, 2)
            .map((p) => ({ name: p.name, reason: clampStr(p.reason, 80) })),
        };
      },
    };
  },

  // Lunch hint
  // state:  { dateLabel, dateISO, isSchoolDay, menu: string[] }
  // output: { kidPreferenceHint: string (≤160 chars) }
  lunch(state) {
    const menu = Array.isArray(state?.menu) ? state.menu.slice(0, 5) : [];
    return {
      system:
        'You write ONE short helpful hint about tomorrow\'s school lunch for a family deciding school-vs-home lunch. Max 160 chars. Do not invent kid names or preferences — if the menu is empty, say so briefly. No emojis. Respond with strict JSON: {"kidPreferenceHint":"..."}.',
      user: `Tomorrow is ${state?.dateLabel ?? "a school day"}. School menu: ${menu.length ? menu.join(", ") : "(not loaded)"}. Write one line noting whether school lunch looks appealing.`,
      validate: (fields) => ({
        kidPreferenceHint: clampStr(fields?.kidPreferenceHint, 200),
      }),
    };
  },

  // Calendar conflict summary
  // state:  { conflicts: [{a:{title,start}, b:{title,start}, at}], peter0800_0900Risk }
  // output: { summary, suggestion }
  calendarConflict(state) {
    const c = Array.isArray(state?.conflicts) ? state.conflicts[0] : null;
    return {
      system:
        'You summarize a single calendar conflict in friendly everyday language for a family TV dashboard. Exactly two fields: summary (≤120 chars), suggestion (≤140 chars). No emojis. Respond with strict JSON: {"summary":"...","suggestion":"..."}.',
      user: c
        ? `Two things overlap at ${c.at}: "${c.a?.title}" and "${c.b?.title}". Peter has a work block risk 8–9 AM: ${!!state?.peter0800_0900Risk}. Summarize the clash and suggest one small way to handle it.`
        : "There is a morning overlap today but no details. Write a generic heads-up.",
      validate: (fields) => ({
        summary: clampStr(fields?.summary, 160),
        suggestion: clampStr(fields?.suggestion, 180),
      }),
    };
  },

  // Claw suggestions re-phrasing (never re-ranks across tiers; only polishes copy)
  // state:  [{id, tier, title}]
  // output: { items: [{id, title, detail}] }
  clawSuggestions(state) {
    const rows = Array.isArray(state) ? state.slice(0, 6) : [];
    return {
      system:
        'You polish short suggestion titles for a family TV dashboard. Keep each title ≤40 chars and each detail ≤80 chars. Do NOT change the order and do NOT invent new ids. For every input id you must emit a matching output object. No emojis. Respond with strict JSON: {"items":[{"id":"...","title":"...","detail":"..."}]}.',
      user: `Rewrite these suggestions so the titles feel less robotic and the details feel specific:\n${rows.map((r, i) => `${i + 1}. id=${r.id} tier=${r.tier} title=${r.title}`).join("\n")}`,
      validate: (fields) => {
        const validIds = new Set(rows.map((r) => r.id));
        const items = Array.isArray(fields?.items) ? fields.items : [];
        return {
          items: items
            .filter((it) => it && validIds.has(it.id))
            .map((it) => ({
              id: it.id,
              title: clampStr(it.title, 60),
              detail: clampStr(it.detail, 120),
            }))
            .slice(0, rows.length),
        };
      },
    };
  },

  // Birthday gift ideas
  // state:  { name, relation?, daysUntil, constraints?: string[] }
  // output: { ideas: [{idea, priceEstimate, rationale}] (3–5) }
  birthdayGiftIdeas(state) {
    const constraints = asStringArray(state?.constraints, 80, 5);
    return {
      system:
        'You generate 3 to 5 concrete birthday gift ideas for a family member or friend. Each idea: 3–8 word name, rough USD price estimate (e.g. "$25–$40"), and a one-sentence rationale. No generic filler. No emojis. Respond with strict JSON: {"ideas":[{"idea":"...","priceEstimate":"...","rationale":"..."}]}.',
      user: `Recipient: ${state?.name ?? "(unknown)"}${state?.relation ? ` (${state.relation})` : ""}. Birthday in ${state?.daysUntil ?? "?"} days.${constraints.length ? ` Constraints: ${constraints.join("; ")}.` : ""} Generate 3–5 specific gift ideas.`,
      validate: (fields) => {
        const ideas = Array.isArray(fields?.ideas) ? fields.ideas : [];
        return {
          ideas: ideas
            .slice(0, 5)
            .map((it) => ({
              idea: clampStr(it?.idea, 80),
              priceEstimate: clampStr(it?.priceEstimate, 40),
              rationale: clampStr(it?.rationale, 200),
            }))
            .filter((it) => it.idea.length > 0),
        };
      },
    };
  },

  // School-email relevance + structured extraction.
  // state:  { subject, from, snippet, receivedAt }
  // output: {
  //   isRelevant, kind, title, summary, dueDate?, eventDate?,
  //   child?, location?, urgency, suggestedAction?
  // }
  //
  // Policy (matches the family's explicit ask: "only flag actionable"):
  //   - Default is isRelevant=false. The model must justify surfacing.
  //   - Relevance requires EITHER a concrete action the family can take
  //     (sign, return, RSVP, pay, bring, volunteer) OR a dated event
  //     that affects the family's schedule.
  //   - Pure informational school content (newsletters w/ no date/action,
  //     fundraising blurbs, general "here's what's happening" updates)
  //     returns isRelevant=false.
  schoolUpdates(state) {
    return {
      system:
        'You classify a single email for a family dashboard showing school items. Return strict JSON: ' +
        '{"isRelevant": bool, "kind": "action"|"event"|"reminder"|"info", "title": str, ' +
        '"summary": str, "dueDate": "YYYY-MM-DD"|null, "eventDate": "YYYY-MM-DD"|null, ' +
        '"child": str|null, "location": str|null, "urgency": 0..1, "suggestedAction": str|null}. ' +
        'Only return isRelevant=true if the email contains: (a) a concrete action the family must take ' +
        '(sign/return/RSVP/pay/bring/volunteer) OR (b) a dated school event affecting the family schedule. ' +
        'Newsletters, fundraising, and informational blurbs without dates or actions → isRelevant=false. ' +
        'Non-school emails (retail, shipping, etc.) → isRelevant=false. ' +
        'Keep title ≤60 chars; summary ≤160 chars; suggestedAction ≤100 chars. No emojis.',
      user: [
        `From: ${state?.from ?? "(unknown)"}`,
        `Subject: ${state?.subject ?? ""}`,
        `Received: ${state?.receivedAt ?? ""}`,
        "",
        "Body snippet:",
        String(state?.snippet ?? "").slice(0, 1500),
      ].join("\n"),
      validate: (fields) => {
        const isRelevant = fields?.isRelevant === true;
        if (!isRelevant) {
          return { isRelevant: false };
        }
        const kind = ["action", "event", "reminder", "info"].includes(fields?.kind)
          ? fields.kind
          : "info";
        const urgency = (() => {
          const n = Number(fields?.urgency);
          if (!Number.isFinite(n)) return 0.5;
          return Math.max(0, Math.min(1, n));
        })();
        const dateRe = /^\d{4}-\d{2}-\d{2}$/;
        return {
          isRelevant: true,
          kind,
          title: clampStr(fields?.title, 80),
          summary: clampStr(fields?.summary, 200),
          dueDate: dateRe.test(fields?.dueDate ?? "") ? fields.dueDate : null,
          eventDate: dateRe.test(fields?.eventDate ?? "") ? fields.eventDate : null,
          child: clampStr(fields?.child, 60) || null,
          location: clampStr(fields?.location, 80) || null,
          urgency,
          suggestedAction: clampStr(fields?.suggestedAction, 140) || null,
        };
      },
    };
  },
};

async function fetchBirthdays(appleId, appPassword) {
  const auth = btoa(`${appleId}:${appPassword}`);
  const headers = {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/xml; charset=utf-8",
    Depth: "0",
  };

  // Reuse CalDAV discovery: principal → home → list calendars
  const principalRes = await fetch("https://caldav.icloud.com/", {
    method: "PROPFIND",
    headers,
    body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:current-user-principal/></d:prop>
</d:propfind>`,
  });
  if (!principalRes.ok) throw new Error(`CalDAV auth failed: ${principalRes.status}`);

  const principalXml = await principalRes.text();
  const principalHref = extractHref(principalXml, "current-user-principal");
  if (!principalHref) throw new Error("Could not find principal URL");

  const homeUrl = principalHref.startsWith("http")
    ? principalHref
    : `https://caldav.icloud.com${principalHref}`;
  const homeRes = await fetch(homeUrl, {
    method: "PROPFIND",
    headers,
    body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><c:calendar-home-set/></d:prop>
</d:propfind>`,
  });

  const homeXml = await homeRes.text();
  const homeHref = extractHref(homeXml, "calendar-home-set");
  if (!homeHref) throw new Error("Could not find calendar home");

  const listUrl = homeHref.startsWith("http")
    ? homeHref
    : `https://caldav.icloud.com${homeHref}`;
  const listRes = await fetch(listUrl, {
    method: "PROPFIND",
    headers: { ...headers, Depth: "1" },
    body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">
  <d:prop>
    <d:displayname/>
    <d:resourcetype/>
    <cs:getctag/>
  </d:prop>
</d:propfind>`,
  });

  const listXml = await listRes.text();
  const calendarHrefs = extractCalendarHrefs(listXml, homeHref);

  // Query all calendars for events in the next 90 days that look like birthdays
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endRange = new Date(startOfDay.getTime() + 90 * 86400000);
  const dtStart = toIcalDate(startOfDay);
  const dtEnd = toIcalDate(endRange);

  const allBirthdays = [];

  for (const cal of calendarHrefs) {
    try {
      const reportUrl = cal.href.startsWith("http")
        ? cal.href
        : `https://caldav.icloud.com${cal.href}`;
      const reportRes = await fetch(reportUrl, {
        method: "REPORT",
        headers: { ...headers, Depth: "1" },
        body: `<?xml version="1.0" encoding="utf-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${dtStart}" end="${dtEnd}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`,
      });

      if (reportRes.ok) {
        const reportXml = await reportRes.text();
        const icsBlocks = extractCalendarData(reportXml);
        // Check if this is the Birthdays calendar (iCloud names it "Birthdays")
        const isBirthdayCal = /birthdays?/i.test(cal.name) || /birthdays?/i.test(cal.href);
        for (const ics of icsBlocks) {
          const events = parseBirthdayEvents(ics, today, isBirthdayCal);
          allBirthdays.push(...events);
        }
      }
    } catch {
      // Skip individual calendar errors
    }
  }

  // Deduplicate by name + date
  const seen = new Set();
  const unique = allBirthdays.filter((b) => {
    const key = `${b.name.toLowerCase()}|${b.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by days until
  unique.sort((a, b) => a.daysUntil - b.daysUntil);

  return unique;
}

function extractBirthdayCalId(listXml) {
  // Try to find the calendar ID associated with "Birthdays" display name
  const responses = listXml.split(/<(?:[a-zA-Z0-9]+:)?response[\s>]/i);
  for (const resp of responses) {
    if (/<(?:[a-zA-Z0-9]+:)?displayname[^>]*>\s*Birthdays?\s*</i.test(resp)) {
      const hrefMatch = resp.match(/<(?:[a-zA-Z0-9]+:)?href[^>]*>([^<]+)/i);
      if (hrefMatch) return hrefMatch[1].trim();
    }
  }
  return "";
}

function parseBirthdayEvents(icsText, today, isBirthdayCal) {
  const unfolded = icsText.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  const events = [];
  let inEvent = false;
  let current = {};

  const EMOJIS = ["🎂", "🎉", "🎈", "🎁", "🥳", "✨"];

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      inEvent = false;
      if (current.summary && current.dtstart) {
        // Check if this event is a birthday
        const summary = unescapeIcal(current.summary);
        const isBirthday = isBirthdayCal ||
          /birthday/i.test(summary) ||
          /\bbday\b/i.test(summary) ||
          /\bb-?day\b/i.test(summary) ||
          /born/i.test(summary) ||
          (current.categories && /birthday/i.test(current.categories));

        if (isBirthday) {
          const start = parseIcalDate(current.dtstart);
          if (start) {
            // Calculate days until from today
            const eventDate = new Date(today.getFullYear(), start.getMonth(), start.getDate());
            // If the date already passed this year, look at next year
            if (eventDate < today) {
              eventDate.setFullYear(eventDate.getFullYear() + 1);
            }
            const diffMs = eventDate.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
            const daysUntil = Math.round(diffMs / 86400000);

            // Clean up the name: remove "Birthday", "'s Birthday", etc.
            // Handle both straight and smart apostrophes
            let name = summary;
            // Handle reminder-style: "Wish X a happy birthday" → "X"
            const wishMatch = name.match(/^(?:wish|remind|remember|tell|text|call)\s+(.+?)\s+(?:a\s+)?happy\s*(?:birthday|bday|b-day)/i);
            if (wishMatch) {
              name = wishMatch[1].trim();
            } else {
              name = name
                .replace(/['\u2019]s\s+(?:birthday|bday|b-day)\s*(party)?/i, "")
                .replace(/\s*(?:birthday|bday|b-day)\s*(party)?/i, "")
                .trim();
            }
            // If cleaning left nothing useful, use original
            if (!name || name.length < 2) name = summary.trim();
            // Remove trailing possessive that got orphaned
            name = name.replace(/['\u2019]s\s*$/, "").trim();

            const monthDay = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });

            events.push({
              name,
              date: monthDay,
              daysUntil,
              avatar: EMOJIS[events.length % EMOJIS.length],
            });
          }
        }
      }
      continue;
    }
    if (!inEvent) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const key = line.substring(0, colonIdx).split(";")[0].toUpperCase();
    const value = line.substring(colonIdx + 1);

    if (key === "SUMMARY") current.summary = value;
    if (key === "DTSTART") current.dtstart = line;
    if (key === "CATEGORIES") current.categories = value;
  }

  return events;
}

// ── School Updates (KV-backed) ───────────────────────────────────────

const SCHOOL_UPDATES_KEY = "school_updates";

async function handleSchoolUpdatesPost(request, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "NOTIFICATIONS KV namespace not configured" }, 500);
  }

  const body = await request.json();
  const updates = body.updates;
  if (!Array.isArray(updates)) {
    return json({ error: "Request body must have an 'updates' array" }, 400);
  }

  // Store with timestamp
  const data = {
    updates: updates.slice(0, 10), // Cap at 10 items
    updatedAt: Date.now(),
  };
  await env.NOTIFICATIONS.put(SCHOOL_UPDATES_KEY, JSON.stringify(data));

  return json({ ok: true, count: data.updates.length });
}

async function handleSchoolUpdatesGet(env) {
  if (!env.NOTIFICATIONS) {
    return json({ updates: [], updatedAt: null });
  }

  const data = await env.NOTIFICATIONS.get(SCHOOL_UPDATES_KEY, { type: "json" });
  if (!data) {
    return json({ updates: [], updatedAt: null });
  }

  return json(data);
}

// ── Takeout (tonight's dinner decision) ─────────────────────────────

const VALID_TAKEOUT_DECISIONS = new Set(["takeout", "home"]);

function takeoutKeyForDate(date) {
  return `hc:takeout:${date}`;
}

function todayKey() {
  const n = new Date();
  const y = n.getUTCFullYear();
  const m = String(n.getUTCMonth() + 1).padStart(2, "0");
  const d = String(n.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function handleTakeoutGet(env) {
  if (!env.NOTIFICATIONS) return json(null);
  const today = todayKey();
  const raw = await env.NOTIFICATIONS.get(takeoutKeyForDate(today), { type: "json" });
  if (!raw) return json(null);
  return json(raw);
}

async function handleTakeoutPost(request, env) {
  if (!env.NOTIFICATIONS) return json({ error: "KV not configured" }, 500);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { date, decision, vendor, decidedBy } = body ?? {};
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ error: "date must be YYYY-MM-DD" }, 400);
  }
  if (decision !== null && !VALID_TAKEOUT_DECISIONS.has(decision)) {
    return json({ error: `decision must be one of ${[...VALID_TAKEOUT_DECISIONS].join(", ")} or null` }, 400);
  }
  const record = {
    date,
    decision,
    vendor: typeof vendor === "string" ? vendor : undefined,
    decidedAt: new Date().toISOString(),
    decidedBy: typeof decidedBy === "string" ? decidedBy : undefined,
  };
  await env.NOTIFICATIONS.put(takeoutKeyForDate(date), JSON.stringify(record), {
    // Keep for ~3 days; cheap insurance against long-running stale keys.
    expirationTtl: 60 * 60 * 24 * 3,
  });
  return json({ ok: true, record });
}

// ── Lunch decisions per date ────────────────────────────────────────

const LUNCH_INDEX_KEY = "hc:lunch:index";
function lunchKeyForDate(date) {
  return `hc:lunch:${date}`;
}

async function handleLunchGet(env) {
  if (!env.NOTIFICATIONS) return json({});
  const index = (await env.NOTIFICATIONS.get(LUNCH_INDEX_KEY, { type: "json" })) ?? [];
  const out = {};
  for (const date of index) {
    const rec = await env.NOTIFICATIONS.get(lunchKeyForDate(date), { type: "json" });
    if (rec) out[date] = rec;
  }
  return json(out);
}

async function handleLunchPost(request, env) {
  if (!env.NOTIFICATIONS) return json({ error: "KV not configured" }, 500);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { date, child, choice } = body ?? {};
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ error: "date must be YYYY-MM-DD" }, 400);
  }
  if (typeof child !== "string" || !child) {
    return json({ error: "child required" }, 400);
  }
  if (choice !== "school" && choice !== "home" && choice !== null) {
    return json({ error: "choice must be 'school', 'home', or null" }, 400);
  }
  const existing =
    (await env.NOTIFICATIONS.get(lunchKeyForDate(date), { type: "json" })) ?? {
      date,
      perChild: {},
    };
  existing.perChild[child] = choice;
  existing.updatedAt = new Date().toISOString();
  await env.NOTIFICATIONS.put(lunchKeyForDate(date), JSON.stringify(existing), {
    expirationTtl: 60 * 60 * 24 * 14,
  });
  // Update the date index (trim to last 14 dates).
  const index = (await env.NOTIFICATIONS.get(LUNCH_INDEX_KEY, { type: "json" })) ?? [];
  const next = [date, ...index.filter((d) => d !== date)].slice(0, 14);
  await env.NOTIFICATIONS.put(LUNCH_INDEX_KEY, JSON.stringify(next));
  return json({ ok: true, record: existing });
}

// ── School lunch menu (read-only; ingestion is a separate task) ─────

const SCHOOL_LUNCH_KEY = "hc:school-lunch:menu";

async function handleSchoolLunchGet(env) {
  if (!env.NOTIFICATIONS) return json({ days: [] });
  const raw = await env.NOTIFICATIONS.get(SCHOOL_LUNCH_KEY, { type: "json" });
  if (!raw || !Array.isArray(raw.days)) return json({ days: [] });
  return json(raw);
}

/*
 * TODO: school-lunch ingestion (out of scope for this PR).
 *
 * Write a scheduled worker that monthly:
 *   1. Fetches the two district PDFs (see README / docs).
 *   2. Parses menu items per date.
 *   3. Writes the result to KV at SCHOOL_LUNCH_KEY as `{days: [{date, items, noSchool?}]}`.
 *
 * Until that exists, the dashboard's LunchCard renders a
 * "Menu not loaded yet — check with school" fallback and the derived
 * `lunchDecisionNeeded` flag still works.
 */

// ── Photos ──────────────────────────────────────────────────────────

async function handlePhotos(env) {
  const token = env.PHOTOS_ALBUM_TOKEN;
  if (!token) {
    return json({ error: "PHOTOS_ALBUM_TOKEN not configured on worker. Set it via: wrangler secret put PHOTOS_ALBUM_TOKEN" }, 500);
  }

  // Discover the correct partition via iCloud's 330 redirect
  let host = `p25-sharedstreams.icloud.com`;
  let streamData = null;
  let baseUrl = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const url = `https://${host}/${token}/sharedstreams/webstream`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ streamCtag: null }),
        redirect: "manual",
      });
      if (res.status === 330) {
        // iCloud returns the correct host in the response body or header
        const body = await res.json().catch(() => ({}));
        const redirectHost = body["X-Apple-MMe-Host"] || res.headers.get("X-Apple-MMe-Host");
        if (redirectHost) {
          host = redirectHost;
          continue;
        }
        break;
      }
      if (res.ok) {
        const data = await res.json();
        if (data.photos) {
          streamData = data;
          baseUrl = `https://${host}/${token}/sharedstreams`;
          break;
        }
      }
    } catch {
      break;
    }
  }

  if (!streamData?.photos) {
    return json({ photos: [] });
  }

  const photos = streamData.photos.slice(0, 20);
  const guids = photos.map((p) => p.photoGuid);

  let assetUrls = {};
  try {
    const assetRes = await fetch(`${baseUrl}/webasseturls`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ photoGuids: guids }),
    });
    if (assetRes.ok) {
      const assetData = await assetRes.json();
      assetUrls = assetData.items || {};
    }
  } catch {
    return json({ photos: [] });
  }

  const result = [];
  for (const photo of photos) {
    const derivatives = photo.derivatives || {};
    const best = pickBestDerivative(derivatives);
    if (!best?.checksum) continue;
    const asset = assetUrls[best.checksum];
    if (!asset) continue;
    result.push({
      url: `https://${asset.url_location}${asset.url_path}`,
      cap: photo.caption || "",
    });
  }

  return json({ photos: result });
}

function pickBestDerivative(derivatives) {
  let best = null;
  let bestSize = 0;
  for (const key of Object.keys(derivatives)) {
    const d = derivatives[key];
    const size = (d.width || 0) * (d.height || 0);
    if (size > bestSize && size <= 2000 * 2000) {
      best = d;
      bestSize = size;
    }
  }
  return best || Object.values(derivatives)[0];
}

// ── Notifications (KV-backed) ────────────────────────────────────────

const NOTIF_KEY = "notifications";
const MAX_NOTIFICATIONS = 50;

async function handleNotificationPost(request, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "NOTIFICATIONS KV namespace not configured" }, 500);
  }

  const notification = await request.json();
  if (!notification.id || !notification.title) {
    return json({ error: "Notification requires id and title" }, 400);
  }

  const existing = await env.NOTIFICATIONS.get(NOTIF_KEY, { type: "json" }) || [];
  // Deduplicate by id
  const filtered = existing.filter((n) => n.id !== notification.id);
  filtered.unshift(notification);
  // Cap at max
  const capped = filtered.slice(0, MAX_NOTIFICATIONS);
  await env.NOTIFICATIONS.put(NOTIF_KEY, JSON.stringify(capped));

  // If this is a gesture from HandController, also update the fast-poll gesture key
  if (notification.type === "gesture" && notification.from === "HandController") {
    const m = notification.title?.match(/(Left|Right|L|R|Both) (?:Hands?): (.+)/);
    if (m) {
      // Normalize gesture name to camelCase (e.g. "Wave Left" -> "waveLeft")
      const raw = m[2].trim();
      const gesture = raw.includes(" ") || raw.includes("-")
        ? raw.replace(/[-\s]+(.)/g, (_, c) => c.toUpperCase()).replace(/^./, c => c.toLowerCase())
        : raw;
      await env.NOTIFICATIONS.put("gesture_latest", JSON.stringify({
        gesture,
        hand: m[1],
        timestamp: notification.timestamp || Date.now(),
        id: notification.id,
      }));
    }
  }

  return json({ ok: true, count: capped.length });
}

async function handleGestureGet(env) {
  if (!env.NOTIFICATIONS) {
    return json({ gesture: null });
  }
  const raw = await env.NOTIFICATIONS.get("gesture_latest");
  if (!raw) return json({ gesture: null });
  return json({ gesture: JSON.parse(raw) });
}

// ── Wake Word Debug ──

const WAKE_DEBUG_KEY = "wake_debug_events";
const MAX_WAKE_DEBUG_EVENTS = 50;

async function handleWakeDebugPost(request, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "KV not configured" }, 500);
  }
  const event = await request.json();
  if (!event.type) {
    return json({ error: "Event requires type" }, 400);
  }
  event.id = event.id || `wd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  event.timestamp = event.timestamp || Date.now();

  const existing = await env.NOTIFICATIONS.get(WAKE_DEBUG_KEY, { type: "json" }) || [];
  existing.push(event);
  const capped = existing.slice(-MAX_WAKE_DEBUG_EVENTS);
  await env.NOTIFICATIONS.put(WAKE_DEBUG_KEY, JSON.stringify(capped));
  return json({ ok: true });
}

async function handleWakeDebugGet(env, url) {
  if (!env.NOTIFICATIONS) {
    return json({ events: [] });
  }
  const events = await env.NOTIFICATIONS.get(WAKE_DEBUG_KEY, { type: "json" }) || [];
  const since = parseInt(url.searchParams.get("since") || "0", 10);
  const filtered = since ? events.filter((e) => e.timestamp > since) : events;
  return json({ events: filtered });
}

const WAKE_CONFIG_KEY = "wake_config";
const WAKE_CONFIG_DEFAULTS = {
  detection_threshold: 0.4,
  min_consecutive: 3,
  min_rms_energy: 200,
  score_smooth_window: 3,
  post_action_mute: 8.0,
  high_confidence_bypass: 0.8,
  cooldown_seconds: 5,
  record_seconds: 3.5,
  verify_buffer_seconds: 2.5,
};

async function handleWakeConfigGet(env) {
  if (!env.NOTIFICATIONS) {
    return json(WAKE_CONFIG_DEFAULTS);
  }
  const stored = await env.NOTIFICATIONS.get(WAKE_CONFIG_KEY, { type: "json" });
  return json({ ...WAKE_CONFIG_DEFAULTS, ...stored });
}

async function handleWakeConfigPut(request, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "KV not configured" }, 500);
  }
  const body = await request.json();
  // Only accept known keys with numeric values
  const update = {};
  for (const [key, val] of Object.entries(body)) {
    if (key in WAKE_CONFIG_DEFAULTS && typeof val === "number" && isFinite(val)) {
      update[key] = val;
    }
  }
  const existing = await env.NOTIFICATIONS.get(WAKE_CONFIG_KEY, { type: "json" }) || {};
  const merged = { ...existing, ...update };
  await env.NOTIFICATIONS.put(WAKE_CONFIG_KEY, JSON.stringify(merged));
  return json({ ...WAKE_CONFIG_DEFAULTS, ...merged });
}

// ── Wake Record (voice sample recording control) ───────────────────

const WAKE_RECORD_KEY = "wake_record";

async function handleWakeRecordGet(env) {
  if (!env.NOTIFICATIONS) {
    return json({ active: false, type: "positive", count: 0, totalPositive: 0, totalNegative: 0 });
  }
  // cacheTtl: 0 forces fresh read — KV eventual consistency can otherwise
  // serve stale data for up to 60s, breaking the recording toggle flow.
  const data = await env.NOTIFICATIONS.get(WAKE_RECORD_KEY, { type: "json", cacheTtl: 30 });
  const result = data || { active: false, type: "positive", count: 0, totalPositive: 0, totalNegative: 0 };
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

async function handleWakeRecordPost(request, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "KV not configured" }, 500);
  }
  const body = await request.json();
  const current = await env.NOTIFICATIONS.get(WAKE_RECORD_KEY, { type: "json", cacheTtl: 30 }) ||
    { active: false, type: "positive", count: 0, totalPositive: 0, totalNegative: 0 };

  // Ensure totals exist (migration for existing state)
  if (current.totalPositive == null) current.totalPositive = 0;
  if (current.totalNegative == null) current.totalNegative = 0;

  const action = body.action || "toggle";

  if (action === "start") {
    // If already active, accumulate previous session's count first
    if (current.active && (current.count || 0) > 0) {
      if (current.type === "positive") {
        current.totalPositive += current.count;
      } else {
        current.totalNegative += current.count;
      }
    }
    current.active = true;
    current.type = body.type || "positive";
    current.count = 0;
    current.startedAt = Date.now();
  } else if (action === "stop") {
    // Add session count to totals
    if (current.active) {
      if (current.type === "positive") {
        current.totalPositive += current.count || 0;
      } else {
        current.totalNegative += current.count || 0;
      }
    }
    current.active = false;
  } else if (action === "toggle") {
    if (!current.active) {
      // Starting — reset session count
      current.active = true;
      current.type = body.type || current.type || "positive";
      current.count = 0;
      current.startedAt = Date.now();
    } else {
      // Stopping — add session count to totals
      if (current.type === "positive") {
        current.totalPositive += current.count || 0;
      } else {
        current.totalNegative += current.count || 0;
      }
      current.active = false;
    }
  } else if (action === "increment") {
    // Only increment if currently active — don't force active=true
    if (!current.active) return json(current);
    current.count = (current.count || 0) + 1;
  } else if (action === "set_type") {
    current.type = body.type || "positive";
  } else if (action === "reset_totals") {
    current.totalPositive = 0;
    current.totalNegative = 0;
  } else if (action === "clear_recordings") {
    // Full reset — zero everything and mark inactive.
    // Pi polls for this flag and deletes saved audio files.
    current.active = false;
    current.count = 0;
    current.totalPositive = 0;
    current.totalNegative = 0;
    current.clearRequested = true;
  } else if (action === "sync") {
    // Pi pushes its authoritative state — overwrite KV directly.
    current.active = !!body.active;
    current.type = body.type || "positive";
    current.count = body.count || 0;
    current.totalPositive = body.totalPositive || 0;
    current.totalNegative = body.totalNegative || 0;
  } else if (action === "clear_ack") {
    delete current.clearRequested;
  } else if (action === "status") {
    // Read-only — return current state without writing.
    // Using POST instead of GET to avoid KV edge caching.
    return json(current);
  }

  await env.NOTIFICATIONS.put(WAKE_RECORD_KEY, JSON.stringify(current));
  return json(current);
}

async function handleNotificationGet(env) {
  if (!env.NOTIFICATIONS) {
    return json({ notifications: [] });
  }

  const notifications = await env.NOTIFICATIONS.get(NOTIF_KEY, { type: "json" }) || [];
  return json({ notifications });
}

async function handleNotificationDelete(id, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "NOTIFICATIONS KV namespace not configured" }, 500);
  }

  const existing = await env.NOTIFICATIONS.get(NOTIF_KEY, { type: "json" }) || [];
  const filtered = existing.filter((n) => n.id !== id);
  await env.NOTIFICATIONS.put(NOTIF_KEY, JSON.stringify(filtered));

  return json({ ok: true, removed: existing.length - filtered.length });
}

// ── Timers (KV-backed) ──────────────────────────────────────────────

// ── Navigation ──────────────────────────────────────────────────────

const NAV_KEY = "navigation";

async function handleNavigatePost(request, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "KV namespace NOTIFICATIONS not bound" }, 500);
  }
  const body = await request.json();
  const nav = {
    page: body.page || null,
    view: body.view || null,
    timestamp: Date.now(),
  };
  await env.NOTIFICATIONS.put(NAV_KEY, JSON.stringify(nav));
  return json({ ok: true, navigation: nav });
}

async function handleNavigateGet(env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "KV namespace NOTIFICATIONS not bound" }, 500);
  }
  const raw = await env.NOTIFICATIONS.get(NAV_KEY);
  if (!raw) return json({ navigation: null });
  return json({ navigation: JSON.parse(raw) });
}

// ── Timers ──────────────────────────────────────────────────────────

const TIMERS_KEY = "timers";
const TASKS_KEY = "agent_tasks";

async function handleTimerPost(request, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "NOTIFICATIONS KV namespace not configured" }, 500);
  }

  const body = await request.json();
  const { name, totalSeconds, source } = body;
  if (!name || !totalSeconds || typeof totalSeconds !== "number" || totalSeconds <= 0) {
    return json({ error: "Requires name (string) and totalSeconds (positive number)" }, 400);
  }

  const timer = {
    id: `timer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    totalSeconds,
    expiresAt: Date.now() + totalSeconds * 1000,
    dismissed: false,
    source: source || "manual",
  };

  const existing = await env.NOTIFICATIONS.get(TIMERS_KEY, { type: "json" }) || [];
  existing.push(timer);
  await env.NOTIFICATIONS.put(TIMERS_KEY, JSON.stringify(existing));

  return json({ ok: true, timer });
}

async function handleTimerGet(env) {
  if (!env.NOTIFICATIONS) {
    return json({ timers: [], serverTime: Date.now() });
  }

  const timers = await env.NOTIFICATIONS.get(TIMERS_KEY, { type: "json" }) || [];
  // Prune dismissed timers older than 1 minute — only write if something changed
  const cutoff = Date.now() - 60_000;
  const pruned = timers.filter(t => !t.dismissed || t.expiresAt > cutoff);
  if (pruned.length !== timers.length) {
    await env.NOTIFICATIONS.put(TIMERS_KEY, JSON.stringify(pruned));
  }

  return json({ timers: pruned, serverTime: Date.now() });
}

async function handleTimerDismiss(id, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "NOTIFICATIONS KV namespace not configured" }, 500);
  }

  const timers = await env.NOTIFICATIONS.get(TIMERS_KEY, { type: "json" }) || [];
  let found = false;
  for (const t of timers) {
    if (t.id === id) {
      t.dismissed = true;
      found = true;
    }
  }
  await env.NOTIFICATIONS.put(TIMERS_KEY, JSON.stringify(timers));

  return json({ ok: true, found });
}

async function handleTimerDismissAll(env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "NOTIFICATIONS KV namespace not configured" }, 500);
  }

  const timers = await env.NOTIFICATIONS.get(TIMERS_KEY, { type: "json" }) || [];
  let count = 0;
  for (const t of timers) {
    if (!t.dismissed && t.expiresAt <= Date.now()) {
      t.dismissed = true;
      count++;
    }
  }
  await env.NOTIFICATIONS.put(TIMERS_KEY, JSON.stringify(timers));

  return json({ ok: true, dismissed: count });
}

// ── Agent Tasks (OpenClaw) ──────────────────────────────────────────

async function handleTaskPost(request, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "NOTIFICATIONS KV namespace not configured" }, 500);
  }

  const body = await request.json();
  const { title, detail, source } = body;
  if (!title) {
    return json({ error: "Requires title (string)" }, 400);
  }

  const task = {
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title,
    detail: detail || "",
    status: "active",
    source: source || "openclaw",
    createdAt: Date.now(),
    completedAt: null,
  };

  const existing = await env.NOTIFICATIONS.get(TASKS_KEY, { type: "json" }) || [];
  existing.push(task);
  // Keep max 100 tasks
  const capped = existing.slice(-100);
  await env.NOTIFICATIONS.put(TASKS_KEY, JSON.stringify(capped));

  return json({ ok: true, task });
}

async function handleTaskGet(env) {
  if (!env.NOTIFICATIONS) {
    return json({ tasks: [] });
  }

  const tasks = await env.NOTIFICATIONS.get(TASKS_KEY, { type: "json" }) || [];
  return json({ tasks });
}

async function handleTaskComplete(id, request, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "NOTIFICATIONS KV namespace not configured" }, 500);
  }

  const tasks = await env.NOTIFICATIONS.get(TASKS_KEY, { type: "json" }) || [];
  let found = false;
  for (const t of tasks) {
    if (t.id === id && t.status !== "done") {
      t.status = "done";
      t.completedAt = Date.now();
      found = true;
    }
  }
  await env.NOTIFICATIONS.put(TASKS_KEY, JSON.stringify(tasks));

  return json({ ok: true, found });
}

async function handleTaskDelete(id, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "NOTIFICATIONS KV namespace not configured" }, 500);
  }

  const tasks = await env.NOTIFICATIONS.get(TASKS_KEY, { type: "json" }) || [];
  const filtered = tasks.filter(t => t.id !== id);
  await env.NOTIFICATIONS.put(TASKS_KEY, JSON.stringify(filtered));

  return json({ ok: true, deleted: tasks.length !== filtered.length });
}

// ── iCal Parsing ────────────────────────────────────────────────────

function parseIcalEvents(icsText, rangeStart, rangeEnd) {
  const unfolded = icsText.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  const events = [];
  let inEvent = false;
  let current = {};
  const today = new Date();
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const COLORS = [
    "#FF6B6B", "#4ECDC4", "#FFE66D", "#6BCB77",
    "#9B59B6", "#FF8A5C", "#3498DB", "#E74C3C",
  ];

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      inEvent = false;
      if (current.summary && current.dtstart) {
        const start = parseIcalDate(current.dtstart);
        if (start && start >= rangeStart && start < rangeEnd) {
          const isToday = isSameDay(start, today);
          const dayLabel = isToday
            ? "Today"
            : `${DAYS[start.getDay()]}, ${MONTHS[start.getMonth()]} ${start.getDate()}`;
          events.push({
            time: formatTime(start),
            title: unescapeIcal(current.summary),
            who: current.location ? unescapeIcal(current.location) : "",
            c: COLORS[events.length % COLORS.length],
            startDate: start.getTime(),
            day: dayLabel,
          });
        }
      }
      continue;
    }
    if (!inEvent) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const key = line.substring(0, colonIdx).split(";")[0].toUpperCase();
    const value = line.substring(colonIdx + 1);

    if (key === "SUMMARY") current.summary = value;
    if (key === "DTSTART") current.dtstart = line;
    if (key === "LOCATION") current.location = value;
  }

  return events;
}

function parseIcalDate(str) {
  if (!str) return null;
  const colonIdx = str.lastIndexOf(":");
  const dateStr = colonIdx >= 0 ? str.substring(colonIdx + 1) : str;
  const clean = dateStr.replace(/[^0-9TZ]/g, "");

  if (clean.length === 8) {
    return new Date(
      parseInt(clean.slice(0, 4)),
      parseInt(clean.slice(4, 6)) - 1,
      parseInt(clean.slice(6, 8)),
    );
  }
  if (clean.length >= 15) {
    const y = parseInt(clean.slice(0, 4));
    const mo = parseInt(clean.slice(4, 6)) - 1;
    const d = parseInt(clean.slice(6, 8));
    const h = parseInt(clean.slice(9, 11));
    const mi = parseInt(clean.slice(11, 13));
    const s = parseInt(clean.slice(13, 15));
    if (clean.endsWith("Z")) return new Date(Date.UTC(y, mo, d, h, mi, s));
    return new Date(y, mo, d, h, mi, s);
  }
  return null;
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

function formatTime(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function unescapeIcal(str) {
  return str.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function toIcalDate(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// ── XML helpers for CalDAV ──────────────────────────────────────────

function extractHref(xml, tagName) {
  const pattern = new RegExp(`<[^>]*${tagName}[^>]*>[\\s\\S]*?<[^>]*href[^>]*>([^<]+)`, "i");
  const match = xml.match(pattern);
  return match ? match[1].trim() : null;
}

function extractCalendarHrefs(xml, homeHref) {
  const hrefs = [];
  // Split on any <response> tag regardless of namespace prefix
  const responses = xml.split(/<(?:[a-zA-Z0-9]+:)?response[\s>]/i);
  for (const resp of responses) {
    // Check if this response describes a calendar collection
    const isCollection = /<(?:[a-zA-Z0-9]+:)?collection/i.test(resp);
    const isCalendar = /calendar/i.test(resp) || /VCALENDAR/i.test(resp);
    if (isCollection && isCalendar) {
      // Extract href from any namespace
      const hrefMatch = resp.match(/<(?:[a-zA-Z0-9]+:)?href[^>]*>([^<]+)/i);
      if (hrefMatch) {
        const href = hrefMatch[1].trim();
        // Skip the home href itself (it's the parent, not a calendar)
        const normalizedHref = href.replace(/\/$/, "");
        const normalizedHome = (homeHref || "").replace(/\/$/, "");
        if (normalizedHref !== normalizedHome) {
          // Extract display name
          const nameMatch = resp.match(/<(?:[a-zA-Z0-9]+:)?displayname[^>]*>([^<]*)/i);
          const name = nameMatch ? nameMatch[1].trim() : "";
          hrefs.push({ href, name });
        }
      }
    }
  }
  return hrefs;
}

function extractCalendarData(xml) {
  const blocks = [];
  const pattern = /BEGIN:VCALENDAR[\s\S]*?END:VCALENDAR/g;
  let match;
  while ((match = pattern.exec(xml)) !== null) {
    blocks.push(match[0]);
  }
  return blocks;
}
