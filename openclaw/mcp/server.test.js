import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createMcpHandlers } from "./server.js";
import { callHomeCenterTool, createHomeCenterClient } from "./home-center-client.js";

describe("Home Center MCP server", () => {
  it("lists guarded Home Center tools", async () => {
    const handlers = createMcpHandlers({ client: fakeClient() });
    const response = await handlers.handle({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(response.result.tools.map((tool) => tool.name)).toEqual([
      "calendar_read",
      "home_today",
      "set_timer",
      "tv_power",
      "knowledge_query",
    ]);
  });

  it("rejects TV power calls without explicit confirmation", async () => {
    const client = fakeClient();
    await expect(callHomeCenterTool(client, "tv_power", { state: "off", confirm: false }))
      .rejects.toThrow("confirm=true");
  });

  it("exposes home today as an MCP resource", async () => {
    const handlers = createMcpHandlers({ client: fakeClient() });
    const response = await handlers.handle({
      jsonrpc: "2.0",
      id: 2,
      method: "resources/read",
      params: { uri: "home://today" },
    });
    expect(JSON.parse(response.result.contents[0].text)).toMatchObject({
      calendar: { ok: true },
    });
  });

  it("speaks MCP stdio through the official SDK transport", async () => {
    const client = new Client({ name: "home-center-mcp-test", version: "0.1.0" });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["openclaw/mcp/server.js"],
      env: {
        ...process.env,
        HOME_CENTER_API_URL: "http://127.0.0.1:9",
        HOME_CENTER_PI_URL: "http://127.0.0.1:9",
        HOME_CENTER_AUTH_TOKEN: "",
      },
      stderr: "pipe",
    });

    await client.connect(transport);
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toContain("home_today");
    await client.close();
  });
});

describe("Home Center MCP HTTP client", () => {
  it("sends Worker bearer auth without exposing tokens in config files", async () => {
    const calls = [];
    const client = createHomeCenterClient({
      apiUrl: "https://worker.example",
      authToken: "secret-token",
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return jsonResponse({ events: [] });
      },
    });
    await client.calendarRead();
    expect(calls[0]).toMatchObject({
      url: "https://worker.example/api/calendar",
      options: { headers: expect.objectContaining({ Authorization: "Bearer secret-token" }) },
    });
  });

  it("posts timers with mcp source", async () => {
    const calls = [];
    const client = createHomeCenterClient({
      apiUrl: "https://worker.example",
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return jsonResponse({ ok: true });
      },
    });
    await client.setTimer({ name: "Wake reminder", totalSeconds: 300 });
    expect(calls[0].url).toBe("https://worker.example/api/timers");
    expect(JSON.parse(calls[0].options.body)).toEqual({
      name: "Wake reminder",
      totalSeconds: 300,
      source: "mcp",
    });
  });
});

function fakeClient() {
  return {
    calendarRead: async () => ({ events: [] }),
    homeToday: async () => ({ calendar: { ok: true, data: { events: [] } } }),
    setTimer: async () => ({ ok: true }),
    tvPower: async ({ confirm }) => {
      if (confirm !== true) throw new Error("tv_power requires confirm=true because it changes a shared household device");
      return { ok: true };
    },
    knowledgeQuery: async () => ({ kind: "knowledge" }),
  };
}

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}
