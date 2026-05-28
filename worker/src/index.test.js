import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./index.js";
import {
  artDirectedHeroPrompt,
  buildHeroCompositionPackage,
  buildKnowledgeVisualPlan,
  inferKnowledgeSubtype,
  scoreHeroCompositionQuality,
} from "./knowledgeVisualPlanner.js";

const originalFetch = global.fetch;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createKv(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    get: vi.fn(async (key, options = {}) => {
      const value = store.get(key);
      if (value == null) return null;
      return options.type === "json" ? JSON.parse(value) : value;
    }),
    put: vi.fn(async (key, value) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key) => {
      store.delete(key);
    }),
  };
}

function env(overrides = {}) {
  return {
    NOTIFICATIONS: createKv(),
    OPENAI_API_KEY: "test-openai-key",
    KNOWLEDGE_TEXT_BRIDGE_URL: "https://bridge.test",
    ...overrides,
  };
}

function askRequest(query = "What is a black hole?", bodyOverrides = {}) {
  return new Request("https://worker.test/api/ask-query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, ...bodyOverrides }),
  });
}

function bridgePayloads() {
  return global.fetch.mock.calls
    .filter(([url]) => String(url).startsWith("https://bridge.test"))
    .map(([, options]) => JSON.parse(options.body));
}

function defaultFetchMock({ classification, answer, wikipediaImage = "https://wiki.test/image.jpg", nasaImage = null } = {}) {
  const classificationData = classification || {
    type: "concept",
    title: "Black hole",
    visualNeed: "useful",
    spaceScience: false,
    entityQuery: "Black hole",
    visualSearchQuery: "black hole diagram",
  };
  const answerData = answer || {
    type: "concept",
    title: classificationData.title,
    summary: "A short answer.",
    sections: [],
    infographic: null,
    visualNeed: classificationData.visualNeed,
    imagePrompt: "A clear educational diagram.",
  };

  return vi.fn(async (url, options = {}) => {
    const href = String(url);
    if (href.startsWith("https://bridge.test")) {
      if (href.endsWith("/knowledge-feedback")) {
        return jsonResponse({ ok: true });
      }
      const bridgeCallCount = global.fetch.mock.calls
        .filter(([calledUrl]) => String(calledUrl).startsWith("https://bridge.test")).length;
      return jsonResponse({
        json: bridgeCallCount === 1 ? classificationData : answerData,
        model: "gemma-test",
        log_row_id: `kb-test-${bridgeCallCount}`,
      });
    }
    if (href.startsWith("https://images-api.nasa.gov/search")) {
      return jsonResponse({
        collection: {
          items: nasaImage ? [{
            href: "https://images-assets.nasa.gov/details",
            data: [{
              title: "NASA Black Hole",
              description: "NASA context about a black hole.",
              nasa_id: "NASA-BH",
              center: "NASA",
            }],
            links: [{ href: nasaImage }],
          }] : [],
        },
      });
    }
    if (href.startsWith("https://en.wikipedia.org/w/rest.php/v1/search/page")) {
      return jsonResponse({
        pages: [{
          key: classificationData.entityQuery,
          title: classificationData.title,
          thumbnail: wikipediaImage ? { url: wikipediaImage } : undefined,
        }],
      });
    }
    if (href.startsWith("https://en.wikipedia.org/api/rest_v1/page/summary/")) {
      return jsonResponse({
        title: classificationData.title,
        description: "Wikipedia description.",
        extract: "Wikipedia context for the answer.",
        content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Test" } },
        ...(wikipediaImage ? { originalimage: { source: wikipediaImage } } : {}),
      });
    }
    if (href === "https://api.openai.com/v1/images/generations") {
      return jsonResponse({ data: [{ b64_json: "ZmFrZS1qcGVn" }] });
    }
    throw new Error(`Unexpected fetch: ${href}`);
  });
}

function fetchMockWithWikipediaSummaryFailure({ classification, answer, searchImage }) {
  const base = defaultFetchMock({ classification, answer, wikipediaImage: searchImage, nasaImage: null });
  return vi.fn(async (url, options = {}) => {
    const href = String(url);
    if (href.startsWith("https://en.wikipedia.org/api/rest_v1/page/summary/")) {
      return jsonResponse({ error: "summary unavailable" }, 503);
    }
    return base(url, options);
  });
}

async function askAndRead(currentEnv, query, bodyOverrides = {}) {
  const response = await worker.fetch(askRequest(query, bodyOverrides), currentEnv);
  expect(response.status).toBe(200);
  return response.json();
}

async function enhanceSchoolEmail(modelFields, state = {}) {
  const currentEnv = env({ NOTIFICATIONS: null });
  global.fetch = vi.fn(async (url) => {
    expect(String(url)).toBe("https://api.openai.com/v1/chat/completions");
    return jsonResponse({
      choices: [{ message: { content: JSON.stringify(modelFields) } }],
    });
  });

  const response = await worker.fetch(new Request("https://worker.test/api/claw/enhance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      feature: "schoolUpdates",
      state: {
        from: "teacher@rbusd.org",
        subject: "School update",
        snippet: "School update",
        receivedAt: "2026-05-27T15:00:00Z",
        ...state,
      },
    }),
  }), currentEnv);

  expect(response.status).toBe(200);
  return response.json();
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  global.fetch = originalFetch;
});

describe("claw school updates enhancer", () => {
  it("filters newsletters and shipping while accepting sign-and-return school emails", async () => {
    let body = await enhanceSchoolEmail(
      { isRelevant: false },
      { subject: "Weekly classroom newsletter", snippet: "This week we learned about fractions." },
    );
    expect(body.fields).toEqual({ isRelevant: false });

    body = await enhanceSchoolEmail(
      { isRelevant: false },
      { from: "ship@example.com", subject: "Your package shipped", snippet: "Tracking number 123." },
    );
    expect(body.fields).toEqual({ isRelevant: false });

    body = await enhanceSchoolEmail({
      isRelevant: true,
      kind: "action",
      title: "Return permission slip",
      summary: "Permission slip is due Friday.",
      dueDate: "2026-05-29",
      eventDate: null,
      child: "Olivia",
      urgency: 0.8,
      suggestedAction: "Sign and return the permission slip.",
      requiredActionType: "sign",
    }, {
      subject: "Permission slip",
      snippet: "Please sign and return Olivia's permission slip by Friday.",
    });
    expect(body.fields).toMatchObject({
      isRelevant: true,
      kind: "action",
      suggestedAction: "Sign and return the permission slip.",
      requiredActionType: "sign",
    });
  });

  it.each([
    ["action", "Please sign and return the waiver."],
    ["event", "Book fair is on Friday."],
    ["reminder", "Reminder: library books are due Monday."],
    ["info", "School schedule update."],
  ])("preserves %s classification from model output", async (kind, snippet) => {
    const body = await enhanceSchoolEmail({
      isRelevant: true,
      kind,
      title: `${kind} title`,
      summary: `${kind} summary`,
      dueDate: kind === "action" || kind === "reminder" ? "2026-05-29" : null,
      eventDate: kind === "event" ? "2026-05-29" : null,
      urgency: 0.4,
      suggestedAction: kind === "action" ? "Handle the school action." : null,
    }, { snippet });

    expect(body.fields.kind).toBe(kind);
  });

  it("extracts hidden action items with a concrete suggested action", async () => {
    const body = await enhanceSchoolEmail({
      isRelevant: true,
      kind: "action",
      title: "Return classroom waiver",
      summary: "A long class update includes a waiver due Friday.",
      dueDate: "2026-05-29",
      eventDate: null,
      child: "Olivia",
      urgency: 0.75,
      suggestedAction: "Sign the classroom waiver by Friday.",
      requiredActionType: "sign",
    }, {
      snippet: `${"Class notes. ".repeat(80)} Buried near the end: please sign by Friday.`,
    });

    expect(body.fields).toMatchObject({
      isRelevant: true,
      kind: "action",
      suggestedAction: "Sign the classroom waiver by Friday.",
    });
  });

  it("validates structured dates and optional school metadata", async () => {
    const body = await enhanceSchoolEmail({
      isRelevant: true,
      kind: "event",
      title: "Open house",
      summary: "Open house is scheduled.",
      dueDate: "next Friday",
      eventDate: "2026-06-10",
      child: "Olivia",
      class: "4th Grade",
      teacher: "Ms. Rivera",
      location: "Room 12",
      urgency: 0.35,
      suggestedAction: null,
      requiredActionType: "email",
    });

    expect(body.fields).toMatchObject({
      dueDate: null,
      eventDate: "2026-06-10",
      child: "Olivia",
      class: "4th Grade",
      teacher: "Ms. Rivera",
      location: "Room 12",
      requiredActionType: null,
    });
  });

  it("preserves urgency extremes for near deadlines and distant events", async () => {
    const urgent = await enhanceSchoolEmail({
      isRelevant: true,
      kind: "action",
      title: "Form due tomorrow",
      summary: "The form is due tomorrow.",
      dueDate: "2026-05-29",
      eventDate: null,
      urgency: 0.85,
      suggestedAction: "Return the form tomorrow.",
    });
    const distant = await enhanceSchoolEmail({
      isRelevant: true,
      kind: "event",
      title: "Assembly in three weeks",
      summary: "The assembly is in three weeks.",
      dueDate: null,
      eventDate: "2026-06-18",
      urgency: 0.35,
      suggestedAction: null,
    });

    expect(urgent.fields.urgency).toBeGreaterThanOrEqual(0.7);
    expect(distant.fields.urgency).toBeLessThanOrEqual(0.4);
  });

  it("clamps TV summary copy lengths", async () => {
    const body = await enhanceSchoolEmail({
      isRelevant: true,
      kind: "action",
      title: "T".repeat(90),
      summary: "S".repeat(220),
      dueDate: "2026-05-29",
      eventDate: null,
      urgency: 0.8,
      suggestedAction: "A".repeat(130),
    });

    expect(body.fields.title).toHaveLength(60);
    expect(body.fields.summary).toHaveLength(160);
    expect(body.fields.suggestedAction).toHaveLength(100);
  });

  it("preserves class and teacher extraction fields", async () => {
    const currentEnv = env();
    global.fetch = vi.fn(async (url) => {
      expect(String(url)).toBe("https://api.openai.com/v1/chat/completions");
      return jsonResponse({
        choices: [{
          message: {
            content: JSON.stringify({
              isRelevant: true,
              kind: "action",
              title: "Return field trip slip",
              summary: "Permission slip is due Friday.",
              dueDate: "2026-05-29",
              eventDate: null,
              child: "Olivia",
              class: "4th Grade",
              teacher: "Ms. Rivera",
              location: "Library",
              urgency: 0.8,
              suggestedAction: "Sign and return the permission slip.",
            }),
          },
        }],
      });
    });

    const response = await worker.fetch(new Request("https://worker.test/api/claw/enhance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feature: "schoolUpdates",
        state: {
          from: "teacher@rbusd.org",
          subject: "Field trip slip",
          snippet: "Ms. Rivera needs Olivia's 4th Grade permission slip by Friday.",
          receivedAt: "2026-05-27T15:00:00Z",
        },
      }),
    }), currentEnv);

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.fields).toMatchObject({
      isRelevant: true,
      class: "4th Grade",
      teacher: "Ms. Rivera",
      suggestedAction: "Sign and return the permission slip.",
    });
  });
});

describe("calendar", () => {
  it("expands recurring iCal events whose original start is before the fetch window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T09:00:00-07:00"));
    const currentEnv = env({ CALENDAR_URLS: "https://calendar.test/feed.ics" });
    global.fetch = vi.fn(async (url) => {
      expect(String(url)).toBe("https://calendar.test/feed.ics");
      return new Response(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:weekly-standup
SUMMARY:Weekly Standup
DTSTART:20260504T083000
DTEND:20260504T090000
RRULE:FREQ=WEEKLY;BYDAY=MO
END:VEVENT
END:VCALENDAR`);
    });

    const response = await worker.fetch(new Request("https://worker.test/api/calendar"), currentEnv);
    const body = await response.json();
    const expectedStart = new Date("2026-05-18T08:30:00-07:00").getTime();
    const expectedEnd = new Date("2026-05-18T09:00:00-07:00").getTime();

    expect(response.status).toBe(200);
    expect(body.events).toContainEqual(
      expect.objectContaining({
        id: `weekly-standup-${expectedStart}`,
        title: "Weekly Standup",
        time: "8:30 AM",
        start: expectedStart,
        end: expectedEnd,
      }),
    );
  });

  it("uses the Howell Family iCloud calendar instead of falling back to iPhone calendars", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T09:00:00-07:00"));
    const currentEnv = env({
      ICLOUD_APPLE_ID: "peter@example.com",
      ICLOUD_APP_PASSWORD: "app-password",
    });
    const reportUrls = [];
    global.fetch = vi.fn(async (url, options = {}) => {
      const href = String(url);
      if (options.method === "PROPFIND" && href === "https://caldav.icloud.com/") {
        return new Response(`<d:multistatus xmlns:d="DAV:">
<d:response><d:propstat><d:prop><d:current-user-principal><d:href>/principal/</d:href></d:current-user-principal></d:prop></d:propstat></d:response>
</d:multistatus>`);
      }
      if (options.method === "PROPFIND" && href === "https://caldav.icloud.com/principal/") {
        return new Response(`<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
<d:response><d:propstat><d:prop><c:calendar-home-set><d:href>/calendars/</d:href></c:calendar-home-set></d:prop></d:propstat></d:response>
</d:multistatus>`);
      }
      if (options.method === "PROPFIND" && href === "https://caldav.icloud.com/calendars/") {
        return new Response(`<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
<d:response><d:href>/calendars/iphone/</d:href><d:propstat><d:prop><d:displayname>Peter iPhone</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype></d:prop></d:propstat></d:response>
<d:response><d:href>/calendars/howell-family/</d:href><d:propstat><d:prop><d:displayname>Howell Family</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype></d:prop></d:propstat></d:response>
</d:multistatus>`);
      }
      if (options.method === "REPORT") {
        reportUrls.push(href);
        return new Response(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:family-dinner
SUMMARY:Family Dinner
DTSTART:20260518T173000
DTEND:20260518T183000
END:VEVENT
END:VCALENDAR`);
      }
      throw new Error(`Unexpected fetch: ${href}`);
    });

    const response = await worker.fetch(new Request("https://worker.test/api/calendar"), currentEnv);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(reportUrls).toEqual(["https://caldav.icloud.com/calendars/howell-family/"]);
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({
      title: "Family Dinner",
      calendar: "howell-family",
      calendarName: "Howell Family",
    });
  });
});

describe("design system state", () => {
  it("stores and returns the requested dashboard design system", async () => {
    const currentEnv = env();

    const post = await worker.fetch(new Request("https://worker.test/api/design-system", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: "v2" }),
    }), currentEnv);
    expect(post.status).toBe(200);
    await expect(post.json()).resolves.toMatchObject({
      ok: true,
      designSystem: { version: "v2" },
    });

    const get = await worker.fetch(new Request("https://worker.test/api/design-system"), currentEnv);
    expect(get.status).toBe(200);
    await expect(get.json()).resolves.toMatchObject({
      designSystem: { version: "v2" },
    });
  });
});

describe("knowledge image pipeline", () => {
  it("carries the bridge answer log row id into the stored knowledge response", async () => {
    const currentEnv = env();
    global.fetch = defaultFetchMock();

    const body = await askAndRead(currentEnv, "What is a black hole?");

    expect(body.log_row_id).toBe("kb-test-2");
    expect(await currentEnv.NOTIFICATIONS.get("llm_latest", { type: "json" })).toMatchObject({
      log_row_id: "kb-test-2",
      query: "What is a black hole?",
    });
  });

  it("posts negative knowledge feedback for the latest fresh response", async () => {
    const currentEnv = env();
    global.fetch = defaultFetchMock();
    await askAndRead(currentEnv, "What is a black hole?");

    const response = await worker.fetch(new Request("https://worker.test/api/knowledge-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }), currentEnv);
    const body = await response.json();
    const feedbackCall = global.fetch.mock.calls.find(([url]) => String(url) === "https://bridge.test/knowledge-feedback");
    const feedbackPayload = JSON.parse(feedbackCall[1].body);

    expect(response.status).toBe(200);
    expect(body.flagged).toBe(true);
    expect(feedbackPayload).toMatchObject({
      flag_type: "user_negative",
      target_log_row_id: "kb-test-2",
      query_text: "What is a black hole?",
    });
    expect(feedbackPayload.flagged_at).toEqual(expect.any(String));
  });

  it("posts negative knowledge feedback for an explicit frontend buffer target", async () => {
    const currentEnv = env();
    global.fetch = defaultFetchMock();

    const response = await worker.fetch(new Request("https://worker.test/api/knowledge-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_log_row_id: "kb-front-buffer",
        query_text: "what is an ibis",
        timestamp: Date.now(),
      }),
    }), currentEnv);
    const body = await response.json();
    const feedbackCall = global.fetch.mock.calls.find(([url]) => String(url) === "https://bridge.test/knowledge-feedback");
    const feedbackPayload = JSON.parse(feedbackCall[1].body);

    expect(response.status).toBe(200);
    expect(body.flagged).toBe(true);
    expect(feedbackPayload).toMatchObject({
      flag_type: "user_negative",
      target_log_row_id: "kb-front-buffer",
      query_text: "what is an ibis",
    });
  });

  it("posts negative image feedback separately for the latest displayed image", async () => {
    const notifications = createKv({
      llm_latest: JSON.stringify({
        kind: "knowledge",
        query: "what is an ibis",
        log_row_id: "kb-image",
        timestamp: Date.now(),
        imageSourceType: "known",
        imageUrl: "https://wiki.test/ibis.jpg",
      }),
    });
    const currentEnv = env({ NOTIFICATIONS: notifications });
    global.fetch = defaultFetchMock();

    const response = await worker.fetch(new Request("https://worker.test/api/knowledge-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback_type: "image" }),
    }), currentEnv);
    const body = await response.json();
    const feedbackCall = global.fetch.mock.calls.find(([url]) => String(url) === "https://bridge.test/knowledge-feedback");
    const feedbackPayload = JSON.parse(feedbackCall[1].body);

    expect(response.status).toBe(200);
    expect(body.flagged).toBe(true);
    expect(feedbackPayload).toMatchObject({
      flag_type: "user_negative_image",
      target_log_row_id: "kb-image",
      query_text: "what is an ibis",
      image_source_type: "known",
      image_ref: "https://wiki.test/ibis.jpg",
    });
  });

  it("records image feedback locally and purges cached image keys when no bridge row exists", async () => {
    const notifications = createKv({
      llm_latest: JSON.stringify({
        kind: "knowledge",
        query: "how big is the sun",
        log_row_id: null,
        timestamp: Date.now(),
        imageSourceType: "known",
        imageUrl: "https://images-assets.nasa.gov/image/2013-1994/2013-1994~medium.jpg",
        retrieval: {
          subject: "sun",
          classification: {
            type: "concept",
            title: "Sun size",
            visualNeed: "useful",
            spaceScience: true,
            entityQuery: "Sun size diameter Wikipedia",
            visualSearchQuery: "Sun size comparison image",
          },
        },
      }),
      "knowledge:image:v2:query:how-big-is-the-sun": JSON.stringify({ url: "https://bad.test/sun.jpg" }),
      "knowledge:image:v2:subject:sun": JSON.stringify({ url: "https://bad.test/sun.jpg" }),
      "knowledge:image:v2:visual:sun-size-comparison-image": JSON.stringify({ url: "https://bad.test/sun.jpg" }),
    });
    const currentEnv = env({ NOTIFICATIONS: notifications });
    global.fetch = vi.fn(async () => {
      throw new Error("feedback bridge should not be called without a log row id");
    });

    const response = await worker.fetch(new Request("https://worker.test/api/knowledge-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback_type: "image" }),
    }), currentEnv);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      flagged: true,
      reason: "local_image_feedback_recorded",
    });
    expect(notifications.delete).toHaveBeenCalledWith("knowledge:image:v2:query:how-big-is-the-sun");
    expect(notifications.delete).toHaveBeenCalledWith("knowledge:image:v2:subject:sun");
    expect(notifications.delete).toHaveBeenCalledWith("knowledge:image:v2:visual:sun-size-comparison-image");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does not post image feedback when the latest knowledge response showed no image", async () => {
    const notifications = createKv({
      llm_latest: JSON.stringify({
        kind: "knowledge",
        query: "what is the meaning of justice",
        log_row_id: "kb-none",
        timestamp: Date.now(),
        imageSourceType: "none",
        imageUrl: null,
      }),
    });
    const currentEnv = env({ NOTIFICATIONS: notifications });
    global.fetch = vi.fn(async () => {
      throw new Error("feedback bridge should not be called");
    });

    const response = await worker.fetch(new Request("https://worker.test/api/knowledge-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback_type: "image" }),
    }), currentEnv);
    const body = await response.json();

    expect(body).toMatchObject({
      ok: true,
      flagged: false,
      reason: "no_recent_knowledge_image",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("writes separate answer and image flags for the same response", async () => {
    const notifications = createKv({
      llm_latest: JSON.stringify({
        kind: "knowledge",
        query: "what is an ibis",
        log_row_id: "kb-shared",
        timestamp: Date.now(),
        imageSourceType: "known",
        imageUrl: "https://wiki.test/ibis.jpg",
      }),
    });
    const currentEnv = env({ NOTIFICATIONS: notifications });
    global.fetch = defaultFetchMock();

    await worker.fetch(new Request("https://worker.test/api/knowledge-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }), currentEnv);
    await worker.fetch(new Request("https://worker.test/api/knowledge-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback_type: "image" }),
    }), currentEnv);

    const feedbackPayloads = global.fetch.mock.calls
      .filter(([url]) => String(url) === "https://bridge.test/knowledge-feedback")
      .map(([, options]) => JSON.parse(options.body));

    expect(feedbackPayloads).toHaveLength(2);
    expect(feedbackPayloads.map((payload) => payload.flag_type)).toEqual([
      "user_negative",
      "user_negative_image",
    ]);
    expect(new Set(feedbackPayloads.map((payload) => payload.target_log_row_id))).toEqual(new Set(["kb-shared"]));
  });


  it("does not post feedback when the latest response is stale", async () => {
    const notifications = createKv({
      llm_latest: JSON.stringify({
        kind: "knowledge",
        query: "What is a black hole?",
        log_row_id: "kb-old",
        timestamp: Date.now() - 11 * 60 * 1000,
      }),
    });
    const currentEnv = env({ NOTIFICATIONS: notifications });
    global.fetch = vi.fn(async () => {
      throw new Error("feedback bridge should not be called");
    });

    const response = await worker.fetch(new Request("https://worker.test/api/knowledge-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }), currentEnv);
    const body = await response.json();

    expect(body).toMatchObject({
      ok: true,
      flagged: false,
      reason: "stale_knowledge_response",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("generates GPT Image 2 imagery while preserving cached/Wikipedia answer context", async () => {
    const notifications = createKv({
      "knowledge:image:v2:query:what-is-a-black-hole": JSON.stringify({
        url: "https://cache.test/black-hole.jpg",
        source: "NASA",
        mode: "retrieved",
      }),
    });
    const currentEnv = env({ NOTIFICATIONS: notifications });
    global.fetch = defaultFetchMock({
      classification: {
        type: "concept",
        title: "Black hole",
        visualNeed: "useful",
        spaceScience: false,
        entityQuery: "Black hole",
        visualSearchQuery: "black hole diagram",
      },
      wikipediaImage: "https://wiki.test/black-hole.jpg",
    });

    const body = await askAndRead(currentEnv, "What is a black hole?");
    const imageCalls = global.fetch.mock.calls.filter(([url]) => String(url) === "https://api.openai.com/v1/images/generations");
    const answerPayload = bridgePayloads()[1];
    const answerInput = JSON.parse(answerPayload.messages[1].content);

    expect(imageCalls).toHaveLength(1);
    expect(answerInput.retrievalContext.wikipedia.extract).toBe("Wikipedia context for the answer.");
    expect(body.imageUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(body.visual.source).toBe("GPT Image 2");
    expect(body.visual.model).toBe("gpt-image-2");
  });

  it("uses GPT Image 2 instead of retrieved NASA imagery for space science queries", async () => {
    const currentEnv = env();
    global.fetch = defaultFetchMock({
      classification: {
        type: "concept",
        title: "Black hole",
        visualNeed: "required",
        spaceScience: true,
        entityQuery: "Black hole",
        visualSearchQuery: "black hole",
      },
      nasaImage: "http://nasa.test/black-hole.jpg",
      wikipediaImage: "https://wiki.test/black-hole.jpg",
    });

    const body = await askAndRead(currentEnv, "Show me a black hole");
    const imageCalls = global.fetch.mock.calls.filter(([url]) => String(url) === "https://api.openai.com/v1/images/generations");

    expect(imageCalls).toHaveLength(1);
    expect(body.imageUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(body.visual.source).toBe("GPT Image 2");
    expect(body.visual.mode).toBe("generated");
    expect(body.visual.model).toBe("gpt-image-2");
  });

  it("generates GPT Image 2 fallback metadata when retrieval has no image", async () => {
    const currentEnv = env();
    global.fetch = defaultFetchMock({
      classification: {
        type: "concept",
        title: "Democracy",
        visualNeed: "required",
        spaceScience: false,
        entityQuery: "Democracy",
        visualSearchQuery: "democracy symbolic picture",
      },
      wikipediaImage: null,
    });

    const body = await askAndRead(currentEnv, "Show me a picture of democracy");
    const imageCall = global.fetch.mock.calls.find(([url]) => String(url) === "https://api.openai.com/v1/images/generations");
    const requestBody = JSON.parse(imageCall[1].body);

    expect(requestBody).toMatchObject({
      model: "gpt-image-2",
      quality: "low",
      size: "1536x1024",
      output_format: "jpeg",
    });
    expect(body.visual.source).toBe("GPT Image 2");
    expect(body.visual.mode).toBe("generated");
    expect(body.visual.model).toBe("gpt-image-2");
    expect(body.visual.metadata).toMatchObject({
      quality: "low",
      size: "1536x1024",
      outputFormat: "jpeg",
      promptSource: "worker-enriched",
      generator: "openai",
    });
  });

  it("pins generated knowledge images to GPT Image 2 despite legacy env overrides", async () => {
    const currentEnv = env({
      IMAGE_GENERATION_MODEL: "dall-e-3",
      OPENAI_IMAGE_MODEL: "dall-e-3",
    });
    global.fetch = defaultFetchMock({
      classification: {
        type: "concept",
        title: "Democracy",
        visualNeed: "required",
        spaceScience: false,
        entityQuery: "Democracy",
        visualSearchQuery: "democracy symbolic picture",
      },
      wikipediaImage: null,
    });

    const body = await askAndRead(currentEnv, "Show me a picture of democracy");
    const imageCall = global.fetch.mock.calls.find(([url]) => String(url) === "https://api.openai.com/v1/images/generations");
    const requestBody = JSON.parse(imageCall[1].body);

    expect(requestBody.model).toBe("gpt-image-2");
    expect(body.visual.model).toBe("gpt-image-2");
  });

  it("returns typed page modules and leaves diagram visuals for the React UI", async () => {
    const currentEnv = env();
    global.fetch = defaultFetchMock({
      classification: {
        type: "flora",
        title: "Giant sequoia",
        visualNeed: "required",
        spaceScience: false,
        entityQuery: "Giant sequoia",
        visualSearchQuery: "giant sequoia range and scale infographic",
      },
      answer: {
        type: "flora",
        title: "Giant sequoia",
        summary: "Giant sequoias are enormous conifer trees.",
        sections: [],
        profile: {
          facts: [
            { label: "Species", value: "Sequoiadendron giganteum" },
            { label: "Years on Earth", value: "Ancient conifer lineage" },
          ],
          maps: [{ scope: "world", label: "World range", value: "Sierra Nevada, California" }],
          relatedConcepts: [],
        },
        infographics: [{
          title: "Tree scale",
          kind: "comparison",
          description: "Compare giant sequoia height and trunk volume with familiar objects.",
          items: [{ label: "Height", value: "Up to 95 m" }],
        }],
        infographic: {
          type: "stats",
          items: [{ label: "Height", value: "Up to 95 m" }],
        },
        visualNeed: "required",
        imageSourceType: "diagram",
        imageQuery: "giant sequoia range and scale infographic",
      },
      wikipediaImage: null,
    });

    const body = await askAndRead(currentEnv, "Tell me about giant sequoias");
    const imageCalls = global.fetch.mock.calls.filter(([url]) => String(url) === "https://api.openai.com/v1/images/generations");

    expect(body).toMatchObject({
      type: "flora",
      imageSourceType: "diagram",
      imagePending: false,
      imageUrl: null,
      imagePrompt: null,
      visual: {
        source: "none",
        mode: "none",
        metadata: { reason: "ui_rendered_diagram" },
      },
      profile: {
        facts: [
          { label: "Species", value: "Sequoiadendron giganteum" },
          { label: "Years on Earth", value: "Ancient conifer lineage" },
        ],
        maps: [{ scope: "world", label: "World range", value: "Sierra Nevada, California" }],
      },
      infographics: [{ title: "Tree scale", kind: "comparison" }],
    });
    expect(imageCalls).toHaveLength(0);
  });

  it("stores a text-first pending response before the generated image finishes", async () => {
    const currentEnv = env();
    global.fetch = defaultFetchMock({
      classification: {
        type: "concept",
        title: "Mercury distance from Earth",
        visualNeed: "useful",
        spaceScience: true,
        entityQuery: "Mercury distance from Earth",
        visualSearchQuery: "Mercury orbit distance from Earth diagram",
      },
      answer: {
        type: "concept",
        title: "How far away Mercury is",
        summary: "Mercury's distance from Earth changes all the time.",
        sections: [],
        infographic: null,
        visualNeed: "useful",
        imageSourceType: "generated",
        imagePrompt: "A calm raw editorial visual of Mercury orbiting the Sun.",
      },
      nasaImage: null,
      wikipediaImage: null,
    });

    const body = await askAndRead(currentEnv, "How far away is Mercury?");
    const latestWrites = currentEnv.NOTIFICATIONS.put.mock.calls
      .filter(([key]) => key === "llm_latest")
      .map(([, value]) => JSON.parse(value));

    expect(latestWrites).toHaveLength(2);
    expect(latestWrites[0]).toMatchObject({
      id: body.id,
      imagePending: true,
      imageUrl: null,
      imageSourceType: "generated",
      visual: {
        metadata: { reason: "image_generating", attemptedModel: "gpt-image-2" },
      },
    });
    expect(latestWrites[1]).toMatchObject({
      id: body.id,
      imagePending: false,
      imageSourceType: "generated",
      visual: { source: "GPT Image 2", model: "gpt-image-2" },
    });
    expect(latestWrites[1].imageUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(latestWrites[1].updatedAt).toBeGreaterThanOrEqual(latestWrites[0].updatedAt);
  });

  it("stores pending text first, then returns the completed image response", async () => {
    const currentEnv = env();
    const ctx = {
      waitUntil: vi.fn(),
    };
    global.fetch = defaultFetchMock({
      classification: {
        type: "concept",
        title: "Mercury distance from Earth",
        visualNeed: "useful",
        spaceScience: true,
        entityQuery: "Mercury distance from Earth",
        visualSearchQuery: "Mercury orbit distance from Earth diagram",
      },
      answer: {
        type: "concept",
        title: "How far away Mercury is",
        summary: "Mercury's distance from Earth changes all the time.",
        sections: [],
        infographic: null,
        visualNeed: "useful",
        imageSourceType: "generated",
        imagePrompt: "A calm raw editorial visual of Mercury orbiting the Sun.",
      },
      nasaImage: null,
      wikipediaImage: null,
    });

    const response = await worker.fetch(askRequest("How far away is Mercury?"), currentEnv, ctx);
    const body = await response.json();

    expect(ctx.waitUntil).not.toHaveBeenCalled();
    expect(body).toMatchObject({
      imagePending: false,
      imageSourceType: "generated",
      visual: { source: "GPT Image 2", model: "gpt-image-2" },
    });
    expect(body.imageUrl).toMatch(/^data:image\/jpeg;base64,/);

    const latestWrites = currentEnv.NOTIFICATIONS.put.mock.calls
      .filter(([key]) => key === "llm_latest")
      .map(([, value]) => JSON.parse(value));

    expect(latestWrites).toHaveLength(2);
    expect(latestWrites[0]).toMatchObject({
      id: body.id,
      imagePending: true,
      imageUrl: null,
      imageSourceType: "generated",
    });
    expect(latestWrites[1]).toMatchObject({
      id: body.id,
      imagePending: false,
      visual: { source: "GPT Image 2", model: "gpt-image-2" },
    });
  });

  it("returns explicit no-image visual shape when a visual is not needed", async () => {
    const currentEnv = env();
    global.fetch = defaultFetchMock({
      classification: {
        type: "concept",
        title: "Ambiguous",
        visualNeed: "none",
        spaceScience: false,
        entityQuery: "Ambiguous",
        visualSearchQuery: "",
      },
      answer: {
        type: "concept",
        title: "Ambiguous",
        summary: "Ambiguous means having more than one possible meaning.",
        sections: [],
        infographic: null,
        visualNeed: "none",
        imagePrompt: "",
      },
      wikipediaImage: null,
    });

    const body = await askAndRead(currentEnv, "What does ambiguous mean?");
    const imageCalls = global.fetch.mock.calls.filter(([url]) => String(url) === "https://api.openai.com/v1/images/generations");

    expect(imageCalls).toHaveLength(0);
    expect(body.imageUrl).toBeNull();
    expect(body.visual).toMatchObject({
      imageUrl: null,
      image: null,
      source: "none",
      mode: "none",
      model: null,
      generated: false,
      metadata: { reason: "visual_not_needed" },
    });
  });

  it("does not generate GPT Image 2 art for known imageSourceType imageQuery", async () => {
    const currentEnv = env();
    global.fetch = defaultFetchMock({
      classification: {
        type: "event",
        title: "Test Moon Mission",
        visualNeed: "required",
        spaceScience: false,
        entityQuery: "Test Moon Mission",
        visualSearchQuery: "Test Moon Mission lunar surface archival photo",
      },
      answer: {
        type: "event",
        title: "Test Moon Mission",
        summary: "The test mission landed on the Moon.",
        sections: [],
        infographic: null,
        visualNeed: "required",
        imageSourceType: "known",
        imageQuery: "Test Moon Mission lunar surface archival photo",
      },
      nasaImage: null,
      wikipediaImage: null,
    });

    const body = await askAndRead(currentEnv, "What happened during the test moon mission?");
    const imageCalls = global.fetch.mock.calls.filter(([url]) => String(url) === "https://api.openai.com/v1/images/generations");

    expect(imageCalls).toHaveLength(0);
    expect(body.imageSourceType).toBe("known");
    expect(body.imageQuery).toBe("Test Moon Mission lunar surface archival photo");
    expect(body.imagePrompt).toBeNull();
    expect(body.imageUrl).toBeNull();
    expect(body.visual).toMatchObject({
      source: "none",
      mode: "none",
      metadata: { reason: "retrieval_failed" },
    });
  });

  it("normalizes question prefixes before Wikipedia retrieval for known people", async () => {
    const currentEnv = env();
    global.fetch = defaultFetchMock({
      classification: {
        type: "person",
        title: "Marie Curie",
        visualNeed: "useful",
        spaceScience: false,
        entityQuery: "Marie Curie biography",
        visualSearchQuery: "Marie Curie portrait",
      },
      answer: {
        type: "person",
        title: "Marie Curie",
        summary: "Marie Curie pioneered research on radioactivity.",
        sections: [],
        infographic: null,
        profile: {
          facts: [{ label: "Notable for", value: "Early computer programming" }],
          relatedConcepts: [],
        },
        visualNeed: "useful",
        imageSourceType: "known",
        imageQuery: "Marie Curie portrait Wikimedia Commons",
      },
      wikipediaImage: "https://wiki.test/curie.jpg",
      nasaImage: null,
    });

    const body = await askAndRead(currentEnv, "Who was Marie Curie?");

    expect(body.retrieval.subject).toBe("Marie Curie");
    expect(body.imageSourceType).toBe("known");
    expect(body.imagePrompt).toBeNull();
    expect(body.imageUrl).toBe("https://wiki.test/curie.jpg");
    expect(body.image).toMatchObject({
      source: "Wikipedia",
      mode: "retrieved",
      sourceUrl: "https://en.wikipedia.org/wiki/Test",
    });
    expect(body.profile.relatedConcepts).toEqual(["timeline", "legacy", "field"]);
  });

  it("falls back to Wikipedia search thumbnails when the summary image path fails", async () => {
    const currentEnv = env();
    const classification = {
      type: "person",
      title: "Marie Curie",
      visualNeed: "useful",
      spaceScience: false,
      entityQuery: "Marie Curie biography",
      visualSearchQuery: "Marie Curie portrait",
    };
    const answer = {
      type: "person",
      title: "Marie Curie",
      summary: "Marie Curie pioneered research on radioactivity.",
      sections: [],
      infographic: null,
      visualNeed: "useful",
      imageSourceType: "known",
      imageQuery: "Marie Curie portrait Wikimedia Commons",
    };
    global.fetch = fetchMockWithWikipediaSummaryFailure({
      classification,
      answer,
      searchImage: "//upload.wikimedia.org/ada-thumb.png",
    });

    const body = await askAndRead(currentEnv, "Who was Marie Curie?");

    expect(body.imageUrl).toBe("https://upload.wikimedia.org/ada-thumb.png");
    expect(body.image).toMatchObject({
      source: "Wikipedia",
      sourceUrl: "https://en.wikipedia.org/wiki/Marie%20Curie%20biography",
      mode: "retrieved",
    });
    expect(body.visual).toMatchObject({
      source: "Wikipedia",
      mode: "retrieved",
    });
  });

  it("normalizes known-topic retrieval to the canonical subject instead of the full question", async () => {
    const currentEnv = env();
    const classification = {
      type: "person",
      title: "Who was Marie Curie?",
      visualNeed: "useful",
      spaceScience: false,
      entityQuery: "Who was Marie Curie?",
      visualSearchQuery: "Who was Marie Curie portrait",
    };
    const answer = {
      type: "person",
      title: "Marie Curie",
      summary: "Marie Curie pioneered research on radioactivity.",
      sections: [],
      infographic: null,
      visualNeed: "useful",
      imageSourceType: "known",
      imageQuery: "Marie Curie portrait",
    };

    global.fetch = vi.fn(async (url, options = {}) => {
      const href = String(url);
      if (href.startsWith("https://bridge.test")) {
        const bridgeCallCount = global.fetch.mock.calls
          .filter(([calledUrl]) => String(calledUrl).startsWith("https://bridge.test")).length;
        return jsonResponse({
          json: bridgeCallCount === 1 ? classification : answer,
          model: "gemma-test",
          log_row_id: `kb-test-${bridgeCallCount}`,
        });
      }
      if (href.startsWith("https://en.wikipedia.org/w/rest.php/v1/search/page")) {
        const q = new URL(href).searchParams.get("q");
        if (q !== "Marie Curie") return jsonResponse({ pages: [] });
        return jsonResponse({
          pages: [{ key: "Marie_Curie", title: "Marie Curie", thumbnail: { url: "https://wiki.test/curie-thumb.jpg" } }],
        });
      }
      if (href.startsWith("https://en.wikipedia.org/api/rest_v1/page/summary/")) {
        return jsonResponse({
          title: "Marie Curie",
          description: "Physicist and chemist",
          extract: "Marie Curie pioneered research on radioactivity.",
          content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Marie_Curie" } },
          originalimage: { source: "https://wiki.test/curie.jpg", width: 640, height: 900 },
        });
      }
      if (href.startsWith("https://commons.wikimedia.org/w/api.php")) {
        return jsonResponse({ query: { pages: {} } });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    });

    const body = await askAndRead(currentEnv, "Who was Marie Curie?", { debug: true });
    const searchQueries = global.fetch.mock.calls
      .map(([url]) => String(url))
      .filter((url) => url.startsWith("https://en.wikipedia.org/w/rest.php/v1/search/page"))
      .map((url) => new URL(url).searchParams.get("q"));
    const summaryPages = global.fetch.mock.calls
      .map(([url]) => String(url))
      .filter((url) => url.startsWith("https://en.wikipedia.org/api/rest_v1/page/summary/"))
      .map((url) => decodeURIComponent(url.split("/").pop()));

    expect(searchQueries).not.toContain("Who was Marie Curie");
    expect(summaryPages).toContain("Marie Curie");
    expect(body.imageUrl).toBe("https://wiki.test/curie.jpg");
    expect(body.imagePrompt).toBeNull();
    expect(body.imagePending).toBe(false);
    expect(body.retrieval.diagnostics.normalizedSubject).toBe("Marie Curie");
  });

  it("preserves Wikimedia Commons metadata when it is the fallback image source", async () => {
    const currentEnv = env();
    global.fetch = defaultFetchMock({
      classification: {
        type: "fauna",
        title: "Blue Whale",
        visualNeed: "useful",
        spaceScience: false,
        entityQuery: "Blue Whale",
        visualSearchQuery: "Blue Whale animal photo",
      },
      answer: {
        type: "fauna",
        title: "Blue Whale",
        summary: "Blue whales live in oceans.",
        sections: [],
        infographic: null,
        visualNeed: "useful",
        imageSourceType: "known",
        imageQuery: "Blue Whale animal photo",
      },
      wikipediaImage: null,
      nasaImage: null,
    });
    global.fetch.mockImplementation(async (url, options = {}) => {
      const href = String(url);
      if (href.startsWith("https://commons.wikimedia.org/w/api.php")) {
        return jsonResponse({
          query: {
            pages: {
              1: {
                title: "File:Blue Whale ocean.jpg",
                imageinfo: [{
                  url: "https://commons.test/blue-whale.jpg",
                  width: 1200,
                  height: 800,
                  descriptionurl: "https://commons.wikimedia.org/wiki/File:Blue_Whale_ocean.jpg",
                  extmetadata: {
                    Artist: { value: "Jane Photographer" },
                    ImageDescription: { value: "Blue whale in the ocean" },
                  },
                }],
              },
            },
          },
        });
      }
      return defaultFetchMock({
        classification: {
          type: "fauna",
          title: "Blue Whale",
          visualNeed: "useful",
          spaceScience: false,
          entityQuery: "Blue Whale",
          visualSearchQuery: "Blue Whale animal photo",
        },
        answer: {
          type: "fauna",
          title: "Blue Whale",
          summary: "Blue whales live in oceans.",
          sections: [],
          infographic: null,
          visualNeed: "useful",
          imageSourceType: "known",
          imageQuery: "Blue Whale animal photo",
        },
        wikipediaImage: null,
        nasaImage: null,
      })(url, options);
    });

    const body = await askAndRead(currentEnv, "Tell me about blue whales.");

    expect(body.imageUrl).toBe("https://commons.test/blue-whale.jpg");
    expect(body.image).toMatchObject({
      source: "Wikimedia Commons",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Blue_Whale_ocean.jpg",
      credit: "Jane Photographer",
      width: 1200,
      height: 800,
    });
  });

  it("exposes retrieval diagnostics only for debug requests", async () => {
    const currentEnv = env();
    global.fetch = defaultFetchMock();

    const normalBody = await askAndRead(currentEnv, "Where is Madagascar?");
    expect(normalBody.retrieval.diagnostics).toBeUndefined();

    global.fetch = defaultFetchMock();
    const debugBody = await askAndRead(currentEnv, "Where is Madagascar?", { debug: true });
    expect(debugBody.retrieval.diagnostics).toMatchObject({
      originalQuery: "Where is Madagascar?",
      normalizedSubject: "Madagascar",
      final: expect.any(Object),
    });
  });

  it("returns the curated Madagascar facts and glance visual", async () => {
    const currentEnv = env();
    global.fetch = defaultFetchMock();

    const body = await askAndRead(currentEnv, "Where is Madagascar?");

    expect(body.profile.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Area", value: "587,041 sq km" }),
      expect.objectContaining({ label: "Capital", value: "Antananarivo" }),
    ]));
    expect(body.infographics[0]).toMatchObject({
      title: "At A Glance",
      visual: {
        url: "/home-center/knowledge-assets/madagascar-island-relief.svg",
      },
    });
    expect(body.infographics[0].items).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Species", value: "200,000+" }),
      expect.objectContaining({ label: "Endemic", value: "90%+" }),
    ]));
  });

  it("uses a pinned curated asset before retrieved candidates", async () => {
    const currentEnv = env({
      CURATED_KNOWLEDGE_ASSETS_JSON: JSON.stringify([{
        topicKey: "ada-lovelace",
        title: "Ada Lovelace",
        type: "person",
        heroImage: {
          url: "https://curated.test/ada-hero.jpg",
          source: "Curated Archive",
          sourceUrl: "https://curated.test/ada",
          credit: "Curator",
          license: "Public domain",
          width: 1400,
          height: 820,
          focalPoint: { x: 0.72, y: 0.42 },
          cropHint: "right-subject",
        },
      }]),
    });
    global.fetch = defaultFetchMock({
      classification: {
        type: "person",
        title: "Ada Lovelace",
        visualNeed: "useful",
        spaceScience: false,
        entityQuery: "Ada Lovelace",
        visualSearchQuery: "Ada Lovelace portrait",
      },
      answer: {
        type: "person",
        title: "Ada Lovelace",
        summary: "Ada Lovelace wrote notes on the Analytical Engine.",
        sections: [],
        visualNeed: "useful",
        imageSourceType: "known",
        imageQuery: "Ada Lovelace portrait",
      },
      wikipediaImage: "https://wiki.test/ada.jpg",
    });

    const body = await askAndRead(currentEnv, "Who was Ada Lovelace?", { debug: true });

    expect(body.imageUrl).toBe("https://curated.test/ada-hero.jpg");
    expect(body.image).toMatchObject({
      mode: "pinned",
      assetMode: "pinned",
      source: "Curated Archive",
      sourceUrl: "https://curated.test/ada",
      cropHint: "right-subject",
      focalPoint: { x: 0.72, y: 0.42 },
    });
    expect(body.curatedAsset).toMatchObject({
      mode: "pinned",
      status: "ready",
      source: "Curated Archive",
    });
    expect(body.retrieval.diagnostics.final.assetMode).toBe("pinned");
    expect(body.visualPlan).toMatchObject({
      visualFamily: "editorial-knowledge-v1",
      queryType: "person",
      compositionPattern: "portrait-right-text-left",
      heroStrategy: "retrieved-single-subject",
      textSafeZone: "left",
      tone: "home-center-dark",
    });
    expect(body.heroComposition).toMatchObject({
      mode: "pinned",
      pattern: "portrait-right-text-left",
      strategy: "retrieved-single-subject",
      composition: {
        pattern: "portrait-right-text-left",
        textSafeZone: "left",
      },
      motif: {
        type: "technical-sketch",
      },
    });
  });

  it("scores retrieved candidates and selects the best relevant hero image", async () => {
    const currentEnv = env();
    global.fetch = vi.fn(async (url, options = {}) => {
      const href = String(url);
      if (href.startsWith("https://bridge.test")) {
        const bridgeCallCount = global.fetch.mock.calls
          .filter(([calledUrl]) => String(calledUrl).startsWith("https://bridge.test")).length;
        return jsonResponse({
          json: bridgeCallCount === 1 ? {
            type: "person",
            title: "Marie Curie",
            visualNeed: "useful",
            spaceScience: false,
            entityQuery: "Marie Curie",
            visualSearchQuery: "Marie Curie portrait",
          } : {
            type: "person",
            title: "Marie Curie",
            summary: "Marie Curie pioneered radioactivity research.",
            sections: [],
            visualNeed: "useful",
            imageSourceType: "known",
            imageQuery: "Marie Curie portrait",
          },
          model: "gemma-test",
        });
      }
      if (href.startsWith("https://en.wikipedia.org/w/rest.php/v1/search/page")) {
        return jsonResponse({ pages: [{ key: "Marie_Curie", title: "Marie Curie", thumbnail: { url: "https://wiki.test/curie-flag.svg" } }] });
      }
      if (href.startsWith("https://en.wikipedia.org/api/rest_v1/page/summary/")) {
        return jsonResponse({
          title: "Marie Curie",
          description: "Physicist",
          extract: "Marie Curie was a physicist and chemist.",
          content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Marie_Curie" } },
          originalimage: { source: "https://wiki.test/curie-flag.svg", width: 1000, height: 600 },
        });
      }
      if (href.startsWith("https://commons.wikimedia.org/w/api.php")) {
        return jsonResponse({
          query: {
            pages: {
              1: {
                title: "File:Marie Curie portrait.jpg",
                imageinfo: [{
                  url: "https://commons.test/curie-portrait.jpg",
                  width: 1300,
                  height: 900,
                  descriptionurl: "https://commons.wikimedia.org/wiki/File:Marie_Curie_portrait.jpg",
                  extmetadata: {
                    Artist: { value: "Historical archive" },
                    ImageDescription: { value: "Marie Curie portrait" },
                  },
                }],
              },
            },
          },
        });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    });

    const body = await askAndRead(currentEnv, "Who was Marie Curie?", { debug: true });

    expect(body.imageUrl).toBe("https://commons.test/curie-portrait.jpg");
    expect(body.image).toMatchObject({
      source: "Wikimedia Commons",
      mode: "retrieved",
      cropHint: "right-subject",
    });
    expect(body.retrieval.diagnostics.attempted.some((candidate) => (
      candidate.failureReason === "bad_summary_image" || candidate.failureReason === "bad_search_thumbnail"
    ))).toBe(true);
    expect(body.retrieval.diagnostics.final.image.score).toBeGreaterThan(45);
    expect(currentEnv.NOTIFICATIONS.put.mock.calls.some(([key, value]) => (
      String(key).startsWith("knowledge:image:v2:")
      && JSON.parse(value).url === "https://commons.test/curie-portrait.jpg"
    ))).toBe(true);
  });

  it("keeps generated curated fallback disabled for known topics by default", async () => {
    const currentEnv = env({ ENABLE_CURATED_HERO_GENERATION: "false" });
    global.fetch = defaultFetchMock({
      classification: {
        type: "fauna",
        title: "Imaginary Test Animal",
        visualNeed: "required",
        spaceScience: false,
        entityQuery: "Imaginary Test Animal",
        visualSearchQuery: "Imaginary Test Animal photo",
      },
      answer: {
        type: "fauna",
        title: "Imaginary Test Animal",
        summary: "A test animal answer.",
        sections: [],
        visualNeed: "required",
        imageSourceType: "known",
        imageQuery: "Imaginary Test Animal photo",
      },
      wikipediaImage: null,
      nasaImage: null,
    });

    const body = await askAndRead(currentEnv, "Tell me about imaginary test animals.");
    const imageCalls = global.fetch.mock.calls.filter(([url]) => String(url) === "https://api.openai.com/v1/images/generations");

    expect(imageCalls).toHaveLength(0);
    expect(body.imageSourceType).toBe("known");
    expect(body.imagePending).toBe(false);
    expect(body.imagePrompt).toBeNull();
    expect(body.curatedAsset).toMatchObject({
      mode: "fallback",
      status: "missing",
    });
    expect(body.visualPlan).toMatchObject({
      visualFamily: "editorial-knowledge-v1",
      queryType: "fauna",
      compositionPattern: "fallback-graphic",
      heroStrategy: "fallback-graphic",
      retryPolicy: { maxAttempts: 3 },
    });
  });

  it("builds deterministic visual plans for abstract concept fallbacks", () => {
    expect(buildKnowledgeVisualPlan({
      query: "What is quantum entanglement?",
      title: "Quantum entanglement",
      type: "concept",
      summary: "Quantum entanglement connects measurements across systems.",
      imageSourceType: "none",
      visualNeed: "none",
    })).toMatchObject({
      visualFamily: "editorial-knowledge-v1",
      queryType: "concept",
      subType: "concept/abstract-scientific",
      compositionPattern: "abstract-concept-orbital",
      heroStrategy: "abstract-concept",
      motifStrategy: "paired-field",
      backgroundTreatment: "navy-abstract-linework",
    });
  });

  it("infers topic subtypes and composition patterns from arbitrary topics", () => {
    expect(inferKnowledgeSubtype({
      type: "location",
      query: "Where is Madagascar?",
      title: "Madagascar",
    })).toMatchObject({
      subType: "location/island",
      compositionPattern: "place-scenic-wide",
      motifType: "island-contour",
    });
    expect(inferKnowledgeSubtype({
      type: "flora",
      query: "Tell me about coast redwoods.",
      title: "Coast Redwood",
    })).toMatchObject({
      subType: "flora/tree",
      compositionPattern: "tall-subject-forest-depth",
    });
  });

  it("applies canonical visual plans for the six benchmark knowledge pages", () => {
    const cases = [
      ["What is the internet?", "The Internet", "concept", "concept/network", "concept-layered-diagram-like", "native-concept-hero"],
      ["Where is Madagascar?", "Madagascar", "location", "location/island", "place-scenic-wide", "scenic-location"],
      ["Who was Ada Lovelace?", "Ada Lovelace", "person", "person/historical-scientist", "portrait-right-text-left", "portrait-editorial"],
      ["Tell me about emperor penguins.", "Emperor Penguin", "fauna", "fauna/polar-animal", "species-closeup-with-environment", "species-closeup-with-environment"],
      ["Tell me about coast redwood trees.", "Coast Redwood", "flora", "flora/tree", "tall-subject-forest-depth", "scenic-location"],
      ["What happened during Apollo 11?", "Apollo 11 Moon Landing", "event", "event/space-mission", "archival-event-scene", "archival-event-scene"],
    ];
    for (const [query, title, type, subType, compositionPattern, heroModule] of cases) {
      expect(buildKnowledgeVisualPlan({
        query,
        title,
        type,
        summary: `${title} summary.`,
        imageSourceType: type === "concept" ? "none" : "known",
        visualNeed: type === "concept" ? "none" : "useful",
        image: type === "concept" ? null : {
          url: "https://example.test/hero.jpg",
          width: 1400,
          height: 900,
          focalPoint: { x: 0.68, y: 0.48 },
          tone: "home-center-dark",
        },
      })).toMatchObject({
        subType,
        compositionPattern,
        moduleStyles: {
          hero: heroModule,
          facts: "compact-fact-rows",
        },
      });
    }
  });

  it("rejects fauna-like image candidates for location pages when a scenic alternative exists", async () => {
    const currentEnv = env();
    global.fetch = vi.fn(async (url) => {
      const href = String(url);
      if (href.startsWith("https://bridge.test")) {
        const bridgeCallCount = global.fetch.mock.calls
          .filter(([calledUrl]) => String(calledUrl).startsWith("https://bridge.test")).length;
        return jsonResponse({
          json: bridgeCallCount === 1 ? {
            type: "location",
            title: "Atlantis",
            visualNeed: "useful",
            spaceScience: false,
            entityQuery: "Atlantis",
            visualSearchQuery: "Atlantis island scenic landscape",
          } : {
            type: "location",
            title: "Atlantis",
            summary: "Atlantis is a legendary island.",
            sections: [],
            profile: { maps: [{ label: "Atlantic Ocean", highlight: "Legendary island", lat: 31, lon: -24 }] },
            visualNeed: "useful",
            imageSourceType: "known",
            imageQuery: "Atlantis island scenic landscape",
          },
          model: "gemma-test",
        });
      }
      if (href.startsWith("https://en.wikipedia.org/w/rest.php/v1/search/page")) {
        return jsonResponse({ pages: [{ key: "Atlantis", title: "Atlantis", thumbnail: { url: "https://wiki.test/atlantis-bird.jpg" } }] });
      }
      if (href.startsWith("https://en.wikipedia.org/api/rest_v1/page/summary/")) {
        return jsonResponse({
          title: "Atlantis bird closeup",
          description: "Bird",
          extract: "Atlantis bird closeup.",
          content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Atlantis" } },
          originalimage: { source: "https://wiki.test/atlantis-bird.jpg", width: 1200, height: 800 },
        });
      }
      if (href.startsWith("https://commons.wikimedia.org/w/api.php")) {
        return jsonResponse({
          query: {
            pages: {
              1: {
                title: "File:Atlantis island scenic landscape.jpg",
                imageinfo: [{
                  url: "https://commons.test/atlantis-island-scenic-landscape.jpg",
                  width: 1600,
                  height: 900,
                  descriptionurl: "https://commons.wikimedia.org/wiki/File:Atlantis_island_scenic_landscape.jpg",
                  extmetadata: {
                    Artist: { value: "Archive" },
                    ImageDescription: { value: "Atlantis island scenic coastline landscape" },
                  },
                }],
              },
            },
          },
        });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    });

    const body = await askAndRead(currentEnv, "Where is Atlantis?", { debug: true });

    expect(body.imageUrl).toBe("https://commons.test/atlantis-island-scenic-landscape.jpg");
    expect(body.imageUrl).not.toContain("bird");
    expect(body.retrieval.diagnostics.final.candidates.some((candidate) => (
      candidate.imageUrlPresent && candidate.reasons.includes("location_scenic_subject")
    ))).toBe(true);
  });

  it("scores low-quality hero packages with debug reasons", () => {
    const plan = buildKnowledgeVisualPlan({
      query: "Who was Ada Lovelace?",
      title: "Ada Lovelace",
      type: "person",
      image: {
        url: "https://example.test/ada-small.jpg",
        width: 180,
        height: 140,
        focalPoint: { x: 0.2, y: 0.5 },
        tone: "unknown",
        score: 38,
      },
      imageSourceType: "known",
      visualNeed: "useful",
    });
    const quality = scoreHeroCompositionQuality({
      image: {
        url: "https://example.test/ada-small.jpg",
        width: 180,
        height: 140,
        focalPoint: { x: 0.2, y: 0.5 },
        tone: "unknown",
      },
      visualPlan: plan,
      candidateScore: 38,
    });
    expect(quality.score).toBeLessThan(60);
    expect(quality.reasons).toContain("dimensions_low_or_unknown");
    expect(quality.reasons).toContain("subject_may_conflict_with_text_safe_zone");
  });

  it("creates a rich hero composition package", () => {
    const plan = buildKnowledgeVisualPlan({
      query: "Tell me about emperor penguins.",
      title: "Emperor Penguin",
      type: "fauna",
      image: {
        url: "https://example.test/penguin.jpg",
        source: "Wikimedia Commons",
        width: 1400,
        height: 900,
        focalPoint: { x: 0.68, y: 0.48 },
        cropHint: "right-subject",
        tone: "home-center-dark",
        score: 84,
      },
      imageSourceType: "known",
      visualNeed: "useful",
    });
    expect(buildHeroCompositionPackage(plan, {
      url: "https://example.test/penguin.jpg",
      source: "Wikimedia Commons",
      width: 1400,
      height: 900,
      focalPoint: { x: 0.68, y: 0.48 },
      cropHint: "right-subject",
      tone: "home-center-dark",
      score: 84,
    })).toMatchObject({
      mode: "retrieved",
      baseImage: { url: "https://example.test/penguin.jpg" },
      overlays: { leftGradient: true, navyTone: true },
      motif: { assetKey: "snow-habitat-rings" },
      composition: {
        pattern: "species-closeup-with-environment",
        objectPosition: "68% 48%",
      },
    });
  });

  it("keeps art-directed generation gated and produces constrained prompts", async () => {
    const plan = buildKnowledgeVisualPlan({
      query: "Tell me about obscure test animals.",
      title: "Obscure Test Animal",
      type: "fauna",
      imageSourceType: "known",
      visualNeed: "required",
    });
    const prompt = artDirectedHeroPrompt({ title: "Obscure Test Animal", visualPlan: plan });
    expect(prompt).toContain("No text");
    expect(prompt).toContain("No labels");
    expect(prompt).toContain("No UI");
    expect(prompt).toContain("No poster");
    expect(prompt).toContain("text-safe area");
  });

  it("canonicalizes smallest-country and World Wide Web inventor queries for retrieval", async () => {
    const currentEnv = env();
    global.fetch = defaultFetchMock({
      classification: {
        type: "concept",
        title: "Tim Berners-Lee",
        visualNeed: "none",
        spaceScience: false,
        entityQuery: "World Wide Web inventor",
        visualSearchQuery: "World Wide Web inventor",
      },
      answer: {
        type: "concept",
        title: "World Wide Web inventor",
        summary: "Tim Berners-Lee invented the World Wide Web.",
        sections: [],
        visualNeed: "none",
        imageSourceType: "none",
      },
      wikipediaImage: "https://wiki.test/tim.jpg",
    });

    const body = await askAndRead(currentEnv, "Who invented the World Wide Web?", { debug: true });

    expect(body.retrieval.subject).toBe("Tim Berners-Lee");
    expect(body.type).toBe("person");
    expect(body.imageSourceType).toBe("known");
    expect(body.imagePrompt).toBeNull();
    expect(body.imagePending).toBe(false);
    expect(body.imageUrl).toBe("https://wiki.test/tim.jpg");
  });

  it("keeps photosynthesis on the native diagram path without image generation", async () => {
    const currentEnv = env();
    global.fetch = defaultFetchMock({
      classification: {
        type: "concept",
        title: "Photosynthesis",
        visualNeed: "none",
        spaceScience: false,
        entityQuery: "Photosynthesis",
        visualSearchQuery: "photosynthesis process diagram",
      },
      answer: {
        type: "concept",
        title: "Photosynthesis",
        summary: "Photosynthesis lets plants turn light into chemical energy.",
        sections: [],
        visualNeed: "none",
        imageSourceType: "none",
      },
      wikipediaImage: null,
    });

    const body = await askAndRead(currentEnv, "What is photosynthesis?");

    expect(body.imageSourceType).toBe("diagram");
    expect(body.imagePrompt).toBeNull();
    expect(body.imagePending).toBe(false);
    expect(body.visual.metadata.reason).toBe("ui_rendered_diagram");
  });

  it("normalizes sun size questions to a concise answer and retrieved NASA visual", async () => {
    const currentEnv = env();
    global.fetch = defaultFetchMock({
      classification: {
        type: "concept",
        title: "The Sun",
        visualNeed: "required",
        spaceScience: true,
        entityQuery: "Sun",
        visualSearchQuery: "NASA Sun image solar disk Earth size comparison",
      },
      answer: {
        type: "concept",
        title: "Poor Generic Answer",
        summary: "This response does not mention the Sun.",
        sections: [],
        infographic: null,
        visualNeed: "required",
        imageSourceType: "generated",
        imagePrompt: "A fake cartoon star.",
      },
      wikipediaImage: null,
      nasaImage: "https://nasa.test/sun.jpg",
    });

    const body = await askAndRead(currentEnv, "Hey Homer, how big is the sun?");
    const imageCalls = global.fetch.mock.calls.filter(([url]) => String(url) === "https://api.openai.com/v1/images/generations");

    expect(imageCalls).toHaveLength(0);
    expect(body.title).toBe("The Sun's Size");
    expect(body.summary).toContain("1.39 million kilometers");
    expect(body.summary).toContain("109 Earths");
    expect(body.imageSourceType).toBe("known");
    expect(body.imageQuery).toBe("NASA Sun image solar disk Earth size comparison");
    expect(body.imagePrompt).toBeNull();
    expect(body.imageUrl).toBe("https://nasa.test/sun.jpg");
    expect(body.image).toMatchObject({
      url: "https://nasa.test/sun.jpg",
      source: "NASA",
      mode: "retrieved",
      assetRole: "hero",
    });
    expect(body.retrieval.subject).toBe("sun");
    expect(body.visual.source).toBe("NASA");
    expect(body.visual.mode).toBe("retrieved");
    expect(body.visual.metadata.retrievalSource).toBe("NASA");
  });

  it("answers moon distance questions with exact facts and a UI-rendered distance diagram", async () => {
    const currentEnv = env();
    global.fetch = defaultFetchMock({
      classification: {
        type: "concept",
        title: "The Moon",
        visualNeed: "required",
        spaceScience: true,
        entityQuery: "Moon",
        visualSearchQuery: "Moon distance from Earth NASA",
      },
      answer: {
        type: "concept",
        title: "Poor Generic Moon Answer",
        summary: "The Moon is a natural satellite.",
        sections: [],
        infographic: null,
        visualNeed: "required",
        imageSourceType: "known",
        imageQuery: "Moon photograph",
      },
      wikipediaImage: "https://wiki.test/plain-moon-photo.jpg",
      nasaImage: "https://nasa.test/unrelated-moon-photo.jpg",
    });

    const body = await askAndRead(currentEnv, "Hey Homer, how far away is the moon?");
    const imageCalls = global.fetch.mock.calls.filter(([url]) => String(url) === "https://api.openai.com/v1/images/generations");

    expect(body.title).toBe("Moon Distance");
    expect(body.summary).toContain("384,400 kilometers");
    expect(body.summary).toContain("238,855 miles");
    expect(body.summary).toContain("363,300 km");
    expect(body.imageSourceType).toBe("diagram");
    expect(body.imageQuery).toContain("384,400 km");
    expect(body.imagePrompt).toBeNull();
    expect(body.imageUrl).toBeNull();
    expect(body.visual).toMatchObject({
      source: "none",
      mode: "none",
      metadata: { reason: "ui_rendered_diagram" },
    });
    expect(imageCalls).toHaveLength(0);
  });

  it("generates only when imageSourceType is generated and imagePrompt is present", async () => {
    const currentEnv = env();
    global.fetch = defaultFetchMock({
      classification: {
        type: "concept",
        title: "Democracy",
        visualNeed: "useful",
        spaceScience: false,
        entityQuery: "Democracy",
        visualSearchQuery: "democracy",
      },
      answer: {
        type: "concept",
        title: "Democracy",
        summary: "Democracy is a system where people participate in government.",
        sections: [],
        infographic: null,
        visualNeed: "useful",
        imageSourceType: "generated",
        imagePrompt: "A simple symbolic civic scene with people voting and discussing ideas peacefully.",
      },
      wikipediaImage: null,
    });

    const body = await askAndRead(currentEnv, "What does democracy look like?");
    const imageCall = global.fetch.mock.calls.find(([url]) => String(url) === "https://api.openai.com/v1/images/generations");
    const requestBody = JSON.parse(imageCall[1].body);

    expect(requestBody.prompt).toContain("people voting");
    expect(requestBody.prompt).toContain("No text.");
    expect(requestBody.prompt).toContain("No labels.");
    expect(requestBody.prompt).toContain("No UI.");
    expect(requestBody.prompt).toContain("No poster.");
    expect(requestBody.prompt).toContain("No infographic panels.");
    expect(requestBody.prompt).toContain("No logos.");
    expect(requestBody.prompt).toContain("Leave negative space for Home Center UI text.");
    expect(body.imageSourceType).toBe("generated");
    expect(body.imageQuery).toBeNull();
    expect(body.visual.mode).toBe("generated");
  });

  it("keeps retrieval anchored when classification drifts to dashboard terms", async () => {
    const currentEnv = env();
    global.fetch = vi.fn(async (url, options = {}) => {
      const href = String(url);
      if (href.startsWith("https://bridge.test")) {
        const bridgeCallCount = global.fetch.mock.calls
          .filter(([calledUrl]) => String(calledUrl).startsWith("https://bridge.test")).length;
        return jsonResponse({
          json: bridgeCallCount === 1 ? {
            type: "concept",
            title: "Wake Word",
            visualNeed: "required",
            spaceScience: false,
            entityQuery: "wake word",
            visualSearchQuery: "voice assistant wake word",
          } : {
            type: "concept",
            title: "Wake Word",
            summary: "Wake words activate voice assistants.",
            sections: [{ heading: "Voice", content: "Wake words are used by smart speakers." }],
            infographic: null,
            visualNeed: "required",
            imagePrompt: "A voice assistant wake word diagram.",
          },
          model: "gemma-test",
        });
      }
      if (href.startsWith("https://en.wikipedia.org/w/rest.php/v1/search/page")) {
        expect(new URL(href).searchParams.get("q")).toBe("ibis");
        return jsonResponse({ pages: [{ key: "Ibis", title: "Ibis" }] });
      }
      if (href.startsWith("https://en.wikipedia.org/api/rest_v1/page/summary/")) {
        return jsonResponse({
          title: "Ibis",
          description: "Long-legged wading birds",
          extract: "Ibises are long-legged wading birds with curved bills.",
          content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Ibis" } },
          originalimage: { source: "https://wiki.test/ibis.jpg" },
        });
      }
      if (href === "https://api.openai.com/v1/images/generations") {
        return jsonResponse({ data: [{ b64_json: "ZmFrZS1qcGVn" }] });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    });

    const body = await askAndRead(currentEnv, "is that i-b's");
    const answerPayload = bridgePayloads()[1];
    const answerInput = JSON.parse(answerPayload.messages[1].content);

    expect(answerInput.subject).toBe("ibis");
    expect(answerInput.retrievalContext.wikipedia.title).toBe("Ibis");
    expect(body.title).toBe("ibis");
    expect(body.summary).toBe("Ibises are long-legged wading birds with curved bills.");
    expect(body.sections).toEqual([]);
    expect(body.imageUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(body.visual.source).toBe("GPT Image 2");
    expect(body.visual.model).toBe("gpt-image-2");
    expect(body.retrieval.classification).toMatchObject({
      title: "ibis",
      entityQuery: "ibis",
      visualSearchQuery: "ibis",
    });
  });

  it("rejects unrelated Wikipedia images instead of showing irrelevant visuals", async () => {
    const currentEnv = env();
    global.fetch = defaultFetchMock({
      classification: {
        type: "concept",
        title: "Ibis",
        visualNeed: "required",
        spaceScience: false,
        entityQuery: "Ibis",
        visualSearchQuery: "Ibis bird",
      },
      wikipediaImage: "https://wiki.test/wake-word.jpg",
    });
    global.fetch.mockImplementation(async (url, options = {}) => {
      const href = String(url);
      if (href.startsWith("https://bridge.test") || href.startsWith("https://api.openai.com/v1/images/generations")) {
        return defaultFetchMock({
          classification: {
            type: "concept",
            title: "Ibis",
            visualNeed: "required",
            spaceScience: false,
            entityQuery: "Ibis",
            visualSearchQuery: "Ibis bird",
          },
          wikipediaImage: null,
        })(url, options);
      }
      if (href.startsWith("https://en.wikipedia.org/w/rest.php/v1/search/page")) {
        return jsonResponse({ pages: [{ key: "Wake_word", title: "Wake word" }] });
      }
      if (href.startsWith("https://en.wikipedia.org/api/rest_v1/page/summary/")) {
        return jsonResponse({
          title: "Wake word",
          description: "Voice assistant phrase",
          extract: "A wake word activates a voice assistant.",
          content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Wake_word" } },
          originalimage: { source: "https://wiki.test/wake-word.jpg" },
        });
      }
      throw new Error(`Unexpected fetch: ${href}`);
    });

    const body = await askAndRead(currentEnv, "ibis");
    expect(body.retrieval.wikipedia).toBeNull();
    expect(body.visual.mode).toBe("generated");
    expect(body.visual.source).toBe("GPT Image 2");
  });
});
