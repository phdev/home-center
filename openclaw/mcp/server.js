#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v3";
import { callHomeCenterTool, createHomeCenterClient, TOOL_DEFINITIONS } from "./home-center-client.js";

const SERVER_INFO = { name: "home-center-mcp", version: "0.1.0" };
const RESOURCE_URI = "home://today";

export function createMcpHandlers({ client = createHomeCenterClient() } = {}) {
  return {
    async handle(request) {
      const { id, method, params = {} } = request || {};

      try {
        if (method === "initialize") {
          return response(id, {
            protocolVersion: params.protocolVersion || "2024-11-05",
            capabilities: {
              tools: {},
              resources: {},
            },
            serverInfo: SERVER_INFO,
          });
        }
        if (method === "notifications/initialized") {
          return null;
        }
        if (method === "tools/list") {
          return response(id, { tools: TOOL_DEFINITIONS });
        }
        if (method === "tools/call") {
          const result = await callHomeCenterTool(client, params.name, params.arguments || {});
          return response(id, {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          });
        }
        if (method === "resources/list") {
          return response(id, {
            resources: [{
              uri: RESOURCE_URI,
              name: "Today / Household State",
              description: "Compact Home Center household state snapshot.",
              mimeType: "application/json",
            }],
          });
        }
        if (method === "resources/read") {
          if (params.uri !== RESOURCE_URI) {
            return error(id, -32602, `Unknown resource: ${params.uri}`);
          }
          const result = await client.homeToday();
          return response(id, {
            contents: [{ uri: RESOURCE_URI, mimeType: "application/json", text: JSON.stringify(result, null, 2) }],
          });
        }
        return error(id, -32601, `Method not found: ${method}`);
      } catch (err) {
        return error(id, -32000, err?.message || String(err));
      }
    },
  };
}

export function createSdkMcpServer({ client = createHomeCenterClient() } = {}) {
  const server = new McpServer(SERVER_INFO);

  server.registerTool("calendar_read", {
    description: TOOL_DEFINITIONS.find((tool) => tool.name === "calendar_read").description,
    inputSchema: { debug: z.boolean().optional() },
    annotations: { readOnlyHint: true },
  }, async (args) => toolResult(await client.calendarRead(args)));

  server.registerTool("home_today", {
    description: TOOL_DEFINITIONS.find((tool) => tool.name === "home_today").description,
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, async () => toolResult(await client.homeToday()));

  server.registerTool("set_timer", {
    description: TOOL_DEFINITIONS.find((tool) => tool.name === "set_timer").description,
    inputSchema: {
      name: z.string().min(1),
      totalSeconds: z.number().positive(),
    },
    annotations: { destructiveHint: false },
  }, async (args) => toolResult(await client.setTimer(args)));

  server.registerTool("tv_power", {
    description: TOOL_DEFINITIONS.find((tool) => tool.name === "tv_power").description,
    inputSchema: {
      state: z.enum(["on", "off"]),
      confirm: z.boolean(),
    },
    annotations: { destructiveHint: true },
  }, async (args) => toolResult(await client.tvPower(args)));

  server.registerTool("knowledge_query", {
    description: TOOL_DEFINITIONS.find((tool) => tool.name === "knowledge_query").description,
    inputSchema: {
      query: z.string().min(1),
    },
    annotations: { readOnlyHint: true },
  }, async (args) => toolResult(await client.knowledgeQuery(args)));

  server.registerResource("home_today", RESOURCE_URI, {
    title: "Today / Household State",
    description: "Compact Home Center household state snapshot.",
    mimeType: "application/json",
  }, async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: "application/json",
      text: JSON.stringify(await client.homeToday(), null, 2),
    }],
  }));

  return server;
}

function toolResult(result) {
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

function response(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function error(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export async function runStdioServer() {
  const server = createSdkMcpServer();
  await server.connect(new StdioServerTransport());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runStdioServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
