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
    events: events.map(({ startDate, ...rest }) => rest),
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

async function handleBirthdays(env) {
  if (!env.ICLOUD_APPLE_ID || !env.ICLOUD_APP_PASSWORD) {
    return json({ error: "CalDAV not configured. Set ICLOUD_APPLE_ID + ICLOUD_APP_PASSWORD." }, 500);
  }

  try {
    const birthdays = await fetchBirthdays(env.ICLOUD_APPLE_ID, env.ICLOUD_APP_PASSWORD);
    return json({ birthdays });
  } catch (e) {
    return json({ error: `Birthdays: ${e.message}`, birthdays: [] }, 500);
  }
}

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

  return json({ ok: true, count: capped.length });
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

const TIMERS_KEY = "timers";

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

  let timers = await env.NOTIFICATIONS.get(TIMERS_KEY, { type: "json" }) || [];
  // Prune dismissed timers older than 1 minute
  const cutoff = Date.now() - 60_000;
  timers = timers.filter(t => !t.dismissed || t.expiresAt > cutoff);
  await env.NOTIFICATIONS.put(TIMERS_KEY, JSON.stringify(timers));

  return json({ timers, serverTime: Date.now() });
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
