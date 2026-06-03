const DEFAULT_API_URL = "http://127.0.0.1:8787";
const DEFAULT_PI_URL = "http://homecenter.local:8765";

export const TOOL_DEFINITIONS = [
  {
    name: "calendar_read",
    description: "Read Home Center calendar events from the HTTP capability layer.",
    inputSchema: {
      type: "object",
      properties: {
        debug: { type: "boolean", description: "Include calendar-source diagnostics when supported." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "home_today",
    description: "Read a compact household state snapshot for agent planning.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "set_timer",
    description: "Create a Home Center timer through the HTTP capability layer.",
    inputSchema: {
      type: "object",
      required: ["name", "totalSeconds"],
      properties: {
        name: { type: "string", minLength: 1 },
        totalSeconds: { type: "number", minimum: 1 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "tv_power",
    description: "Turn the Home Center TV on or off through the Pi CEC API. Requires explicit confirmation.",
    inputSchema: {
      type: "object",
      required: ["state", "confirm"],
      properties: {
        state: { type: "string", enum: ["on", "off"] },
        confirm: { type: "boolean", description: "Must be true for this side-effecting action." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "knowledge_query",
    description: "Ask a family-friendly knowledge question through Home Center's knowledge query endpoint.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", minLength: 1 },
      },
      additionalProperties: false,
    },
  },
];

export function createHomeCenterClient(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is required for Home Center MCP client");
  }

  const apiUrl = trimTrailingSlash(options.apiUrl || process.env.HOME_CENTER_API_URL || DEFAULT_API_URL);
  const piUrl = trimTrailingSlash(options.piUrl || process.env.HOME_CENTER_PI_URL || DEFAULT_PI_URL);
  const authToken = options.authToken ?? process.env.HOME_CENTER_AUTH_TOKEN ?? "";

  async function request(baseUrl, endpoint, requestOptions = {}) {
    const headers = {
      Accept: "application/json",
      ...(requestOptions.body ? { "Content-Type": "application/json" } : {}),
      ...(requestOptions.headers || {}),
    };
    if (authToken && baseUrl === apiUrl) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetchImpl(`${baseUrl}${endpoint}`, {
      ...requestOptions,
      headers,
    });
    const text = await response.text();
    const body = text ? parseJson(text, endpoint) : null;
    if (!response.ok) {
      const detail = body?.error || response.statusText || `HTTP ${response.status}`;
      throw new Error(`${endpoint} failed: ${detail}`);
    }
    return body;
  }

  return {
    async calendarRead({ debug = false } = {}) {
      return request(apiUrl, `/api/calendar${debug ? "?debug=true" : ""}`);
    },

    async homeToday() {
      const [calendar, timers, takeout, lunch, tasks] = await Promise.allSettled([
        request(apiUrl, "/api/calendar"),
        request(apiUrl, "/api/timers"),
        request(apiUrl, "/api/takeout/today"),
        request(apiUrl, "/api/school-lunch"),
        request(apiUrl, "/api/tasks"),
      ]);
      return {
        calendar: settledValue(calendar),
        timers: settledValue(timers),
        takeout: settledValue(takeout),
        schoolLunch: settledValue(lunch),
        tasks: settledValue(tasks),
        generatedAt: new Date().toISOString(),
      };
    },

    async setTimer({ name, totalSeconds }) {
      if (!name || typeof name !== "string") {
        throw new Error("set_timer requires name");
      }
      if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
        throw new Error("set_timer requires totalSeconds > 0");
      }
      return request(apiUrl, "/api/timers", {
        method: "POST",
        body: JSON.stringify({ name, totalSeconds, source: "mcp" }),
      });
    },

    async tvPower({ state, confirm }) {
      if (!["on", "off"].includes(state)) {
        throw new Error("tv_power state must be on or off");
      }
      if (confirm !== true) {
        throw new Error("tv_power requires confirm=true because it changes a shared household device");
      }
      return request(piUrl, `/api/tv/${state}`, { method: "POST" });
    },

    async knowledgeQuery({ query }) {
      if (!query || typeof query !== "string") {
        throw new Error("knowledge_query requires query");
      }
      return request(apiUrl, "/api/ask-query", {
        method: "POST",
        body: JSON.stringify({ query }),
      });
    },
  };
}

export async function callHomeCenterTool(client, name, args = {}) {
  switch (name) {
    case "calendar_read":
      return client.calendarRead(args);
    case "home_today":
      return client.homeToday(args);
    case "set_timer":
      return client.setTimer(args);
    case "tv_power":
      return client.tvPower(args);
    case "knowledge_query":
      return client.knowledgeQuery(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function parseJson(text, endpoint) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${endpoint} returned non-JSON response`);
  }
}

function settledValue(result) {
  if (result.status === "fulfilled") return { ok: true, data: result.value };
  return { ok: false, error: result.reason?.message || String(result.reason) };
}
