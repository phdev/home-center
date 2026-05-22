#!/usr/bin/env node
/**
 * OpenClaw — Telegram bridge service for the home center.
 *
 * Exposes a local HTTP API for sending Telegram messages and
 * optionally forwards incoming messages to an LLM endpoint for replies.
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=<token> node index.js [--port 3100] \
 *     [--llm-url https://home-center-api.phhowell.workers.dev/api/ask]
 *
 * Chat IDs in Telegram are numeric. Direct chats are positive integers,
 * groups are negative, supergroups/channels are prefixed with -100.
 */

import TelegramBot from "node-telegram-bot-api";
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";
import {
  appendKnowledgeFeedbackFlag,
  completeKnowledgeJson,
  KNOWLEDGE_SYSTEM_PROMPT,
  parseJsonResponse,
} from "./knowledge-bridge.js";
import { createHouseholdMemoryLiveHandler } from "./household-memory-live.js";

const { values: args } = parseArgs({
  options: {
    port: { type: "string", default: "3100" },
    "llm-url": { type: "string", default: "" },
  },
});

const PORT = parseInt(args.port, 10);
const LLM_URL = args["llm-url"];
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// Optional — only required when the worker enforces AUTH_TOKEN.
// If the worker is open-access, leave unset and the bridge posts
// without Authorization. If the worker rejects, read the 401 in the
// bridge log and set this on the launchd plist.
const WORKER_AUTH_TOKEN = process.env.WORKER_AUTH_TOKEN || "";
const OPENCLAW_BRIDGE_TOKEN = process.env.OPENCLAW_BRIDGE_TOKEN || "";
const TELEGRAM_POLLING = process.env.TELEGRAM_POLLING !== "false";
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || "openclaw";
const OPENCLAW_AGENT = process.env.OPENCLAW_AGENT || "main";
const OPENCLAW_REPLY_ACCOUNT = process.env.OPENCLAW_REPLY_ACCOUNT || "default";
const OPENCLAW_AGENT_TIMEOUT_SECONDS = process.env.OPENCLAW_AGENT_TIMEOUT_SECONDS || "600";
const OPENCLAW_AGENT_CWD = process.env.OPENCLAW_AGENT_CWD || (
  path.basename(process.cwd()) === "openclaw" ? path.dirname(process.cwd()) : process.cwd()
);

if (!BOT_TOKEN) {
  console.error("ERROR: TELEGRAM_BOT_TOKEN env var is required.");
  console.error("Create a bot via @BotFather on Telegram and export the token.");
  process.exit(1);
}

// --- Telegram Client ---

const bot = new TelegramBot(BOT_TOKEN, { polling: TELEGRAM_POLLING });

let ready = false;
let botInfo = null;

// --- Message queue for Homer CI polling ---
// Stores recent incoming messages so Homer CI can poll them via GET /messages
const messageQueue = [];
const MAX_QUEUE = 100;
const recentThread = [];
const MAX_THREAD = 50;
const OPENCLAW_DASHBOARD_AGENT = process.env.OPENCLAW_DASHBOARD_AGENT || "main";
const OPENCLAW_DASHBOARD_SESSION_ROOT = path.join(
  os.homedir(),
  ".openclaw/agents",
  OPENCLAW_DASHBOARD_AGENT,
  "sessions",
);
const OPENCLAW_SESSION_INDEXES = (process.env.OPENCLAW_SESSION_INDEXES || [
  // The dashboard's Howie card should show the household Howie chat, not the
  // repo/PM Devon chat that may also use Telegram delivery.
  path.join(OPENCLAW_DASHBOARD_SESSION_ROOT, "sessions.json"),
].join(":")).split(":").filter(Boolean);
const REPO_ROOT = path.basename(process.cwd()) === "openclaw"
  ? path.dirname(process.cwd())
  : process.cwd();

let routerModulePromise = null;
const handleLiveHouseholdMemoryCommand = createHouseholdMemoryLiveHandler();

function workerUrl(pathname) {
  if (!LLM_URL) return "";
  try {
    const url = new URL(LLM_URL);
    url.pathname = pathname;
    url.search = "";
    return url.toString();
  } catch {
    return "";
  }
}

async function loadRouter() {
  process.env.CACHE_DB_PATH ||= path.join(REPO_ROOT, "openclaw/cache/semantic.db");
  process.env.LOGS_DIR ||= path.join(REPO_ROOT, "openclaw/logs");
  process.env.DASHBOARD_STATE_PATH ||= path.join(REPO_ROOT, "openclaw/logs/dashboard-state.json");
  routerModulePromise ||= import("./router/index.js");
  return routerModulePromise;
}

function bridgeAuthorized(req) {
  if (!OPENCLAW_BRIDGE_TOKEN) return true;
  const bearer = req.get("Authorization") || "";
  const token = req.get("X-OpenClaw-Bridge-Token") || "";
  return bearer === `Bearer ${OPENCLAW_BRIDGE_TOKEN}` || token === OPENCLAW_BRIDGE_TOKEN;
}

function parseKnowledgeResponse(query, routerResult) {
  const raw = String(routerResult?.response || "").trim();
  let parsed = null;
  try {
    parsed = parseJsonResponse(raw);
  } catch {
    parsed = null;
  }

  return {
    id: `llm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    query,
    type: parsed?.type || "concept",
    title: parsed?.title || query,
    summary: parsed?.summary || raw,
    sections: Array.isArray(parsed?.sections) ? parsed.sections : [],
    infographic: parsed?.infographic || null,
    imageUrl: null,
    imageSourceType: parsed?.imageSourceType || null,
    imageQuery: parsed?.imageQuery || null,
    imagePrompt: parsed?.imagePrompt || parsed?.imageQuery || null,
    timestamp: Date.now(),
    source: "openclaw-router",
    tier: routerResult?.tier || null,
    model: routerResult?.model || null,
    classification: routerResult?.classification || null,
    latency_ms: routerResult?.latency_ms || null,
    cost_usd: routerResult?.cost_usd || 0,
    cache_hit: !!routerResult?.cache_hit,
  };
}

async function storeKnowledgeResponse(response) {
  const url = workerUrl("/api/llm/record");
  if (!url) return { stored: false, reason: "llm-url-not-configured" };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(WORKER_AUTH_TOKEN ? { Authorization: `Bearer ${WORKER_AUTH_TOKEN}` } : {}),
    },
    body: JSON.stringify({ response }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Worker /api/llm/record returned ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function askWorkerKnowledgePipeline(query) {
  const url = workerUrl("/api/ask-query");
  if (!url) return null;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(WORKER_AUTH_TOKEN ? { Authorization: `Bearer ${WORKER_AUTH_TOKEN}` } : {}),
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Worker /api/ask-query returned ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function isDashboardSessionPath(sessionFile) {
  if (!sessionFile) return false;
  const resolved = path.resolve(sessionFile);
  const root = path.resolve(OPENCLAW_DASHBOARD_SESSION_ROOT) + path.sep;
  return resolved.startsWith(root);
}

function pushThreadMessage(entry) {
  recentThread.push(entry);
  while (recentThread.length > MAX_THREAD) recentThread.shift();
}

function mergeThreadMessages(...groups) {
  const byKey = new Map();
  for (const group of groups) {
    for (const message of group) {
      const key = [
        message.chatId || "",
        message.direction || "",
        message.text || "",
        message.timestamp || "",
      ].join("\u0000");
      byKey.set(key, message);
    }
  }
  return [...byKey.values()].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
}

function telegramName(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "Telegram";
}

function textFromMessageContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((item) => item?.type === "text" && item.text)
    .map((item) => item.text)
    .join("\n\n")
    .trim();
}

function stripTelegramEnvelope(text) {
  if (!text.includes("Conversation info (untrusted metadata):")) return text.trim();
  return text.split("```\n\n").pop()?.trim() || text.trim();
}

function voiceAgentMessage(message) {
  const heard = String(message).trim();
  return [
    "[Home Center voice transcription]",
    `Heard: "${heard}"`,
    "",
    "Reply to Peter's spoken message. Telegram cannot show this voice transcript as a Peter-sent bubble, so start the delivered Telegram reply with the Heard line above, then continue with your response.",
  ].join("\n");
}

function stripVoiceAgentMessage(text) {
  const trimmed = text.trim();
  const marker = "[Home Center voice transcription]";
  const markerIndex = trimmed.indexOf(marker);
  if (markerIndex === -1) return trimmed;

  // OpenClaw session history can prefix the voice wrapper with runtime context,
  // e.g. "[Thu ...] [Home Center voice transcription] ...". The dashboard
  // should show only what Peter said, never the agent-delivery instruction text.
  const voiceBlock = trimmed.slice(markerIndex + marker.length).trim();
  const match = voiceBlock.match(/^Heard:\s*["“](.+?)["”]\s*(?:\n|$)/s);
  return match ? match[1].trim() : trimmed;
}

function stripHeardPrefix(text) {
  const trimmed = text.trim();
  const withoutVoiceHeader = trimmed
    .replace(/^(?:\[[^\]\n]+\]\s*)?\[Home Center voice transcription\]\s*\n?/i, "")
    .trim();
  const stripped = withoutVoiceHeader.replace(/^Heard:\s*(?:"[^"]*"|“[^”]*”|[^\n]+)\s*\n+/i, "").trim();
  return stripped || withoutVoiceHeader || trimmed;
}

function dashboardText(role, content) {
  const text = role === "user"
    ? stripVoiceAgentMessage(stripTelegramEnvelope(textFromMessageContent(content)))
    : stripHeardPrefix(textFromMessageContent(content));
  return text.trim();
}

function chatIdFromSession(session) {
  const value = session?.deliveryContext?.to || session?.lastTo || session?.origin?.from || "";
  const match = String(value).match(/^telegram:(.+)$/);
  return match ? match[1] : "";
}

function readJson(pathname) {
  try {
    return JSON.parse(fs.readFileSync(pathname, "utf8"));
  } catch {
    return null;
  }
}

function newestTelegramSession(chatId) {
  const matches = [];
  for (const indexPath of OPENCLAW_SESSION_INDEXES) {
    const index = readJson(indexPath);
    if (!index || typeof index !== "object") continue;
    for (const [key, session] of Object.entries(index)) {
      if (session?.lastChannel !== "telegram" && session?.deliveryContext?.channel !== "telegram") continue;
      const sessionChatId = chatIdFromSession(session);
      if (chatId && sessionChatId !== chatId) continue;
      // Defense-in-depth: even if OPENCLAW_SESSION_INDEXES accidentally includes
      // another agent (for example Devon), the Home Center Howie dashboard only
      // reads the configured dashboard agent's session files.
      if (!isDashboardSessionPath(session?.sessionFile)) continue;
      matches.push({ key, session });
    }
  }
  matches.sort((a, b) => (b.session.updatedAt || 0) - (a.session.updatedAt || 0));
  return matches[0] || null;
}

function openClawThreadMessages(chatId, limit) {
  const match = newestTelegramSession(chatId);
  if (!match) return [];
  let lines = [];
  try {
    lines = fs.readFileSync(match.session.sessionFile, "utf8").trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }

  const messages = [];
  for (const line of lines) {
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    const message = record?.message;
    if (record?.type !== "message" || !message) continue;
    const role = message.role;
    if (role !== "user" && role !== "assistant") continue;
    const isDeliveryMirror = message.provider === "openclaw" && message.model === "delivery-mirror";

    const text = dashboardText(role, message.content);
    if (!text) continue;

    messages.push({
      id: `openclaw:${message.timestamp || record.timestamp}:${messages.length}`,
      chatId: chatIdFromSession(match.session) || chatId,
      direction: role === "user" ? "incoming" : "outgoing",
      sender: role === "user" ? "Peter" : "Howie",
      text,
      timestamp: Math.floor(Number(message.timestamp || Date.parse(record.timestamp) || Date.now()) / 1000),
      isGroup: false,
      source: isDeliveryMirror ? "openclaw-delivery" : "openclaw-session",
    });
  }

  const deduped = [];
  for (const message of messages) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.direction === message.direction && prev.text === message.text) {
      if (message.source === "openclaw-delivery") deduped[deduped.length - 1] = message;
      continue;
    }
    deduped.push(message);
  }
  return deduped.slice(-limit);
}

function runOpenClawAgent(chatId, message) {
  const target = String(chatId).startsWith("telegram:") ? String(chatId) : `telegram:${chatId}`;
  const session = newestTelegramSession(String(chatId));
  const cliArgs = [
    "agent",
    "--agent", OPENCLAW_AGENT,
    "--channel", "telegram",
    "--reply-channel", "telegram",
    "--reply-account", OPENCLAW_REPLY_ACCOUNT,
    "--reply-to", target,
    "--message", voiceAgentMessage(message),
    "--deliver",
    "--json",
    "--timeout", OPENCLAW_AGENT_TIMEOUT_SECONDS,
  ];
  if (session?.session?.sessionId) {
    cliArgs.splice(3, 0, "--session-id", session.session.sessionId);
  }

  const child = spawn(OPENCLAW_BIN, cliArgs, {
    cwd: OPENCLAW_AGENT_CWD,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  child.on("error", (err) => {
    console.error(`OpenClaw agent launch failed: ${err.message}`);
  });
  child.on("close", (code) => {
    if (code === 0) {
      console.log(`OpenClaw agent delivered reply for ${target}`);
      return;
    }
    console.error(
      `OpenClaw agent exited ${code}: ${(stderr || stdout).trim().slice(0, 500)}`,
    );
  });
}

bot.getMe()
  .then((info) => {
    botInfo = info;
    ready = true;
    console.log(`Telegram connected as @${info.username} (${info.id})`);
  })
  .catch((err) => {
    console.error("Telegram auth failure:", err.message);
    process.exit(1);
  });

if (TELEGRAM_POLLING) {
  bot.on("polling_error", (err) => {
    console.error("Telegram polling error:", err.message);
  });
}

// --- Incoming message handler ---
// Direct chats: queue for Homer CI + reply via LLM (OpenClaw family bot)
// Group chats: reply via LLM only (family group chat)

bot.on("message", async (msg) => {
  if (!msg.text) return;
  if (msg.from?.is_bot) return;

  const chatId = String(msg.chat.id);
  const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";

  console.log(
    `Incoming from ${chatId}${isGroup ? " (group)" : ""}: ${msg.text.slice(0, 100)}`,
  );

  pushThreadMessage({
    id: `${chatId}:${msg.message_id}`,
    chatId,
    messageId: msg.message_id,
    direction: "incoming",
    sender: telegramName(msg.from),
    text: msg.text,
    timestamp: msg.date,
    isGroup,
  });

  const memoryCommand = handleLiveHouseholdMemoryCommand({
    text: msg.text,
    chatId,
    messageId: msg.message_id,
    isGroup,
  });

  // Queue non-memory, non-group messages for Homer CI to poll.
  if (!isGroup && !memoryCommand.handled) {
    messageQueue.push({
      id: `${chatId}:${msg.message_id}`,
      from: chatId,
      body: msg.text,
      timestamp: msg.date,
      ack: false,
    });
    while (messageQueue.length > MAX_QUEUE) messageQueue.shift();
  }

  if (memoryCommand.handled) {
    if (memoryCommand.reply) {
      const sent = await bot.sendMessage(msg.chat.id, memoryCommand.reply, {
        reply_to_message_id: msg.message_id,
      });
      pushThreadMessage({
        id: `${chatId}:${sent.message_id}`,
        chatId,
        messageId: sent.message_id,
        direction: "outgoing",
        sender: botInfo?.first_name || botInfo?.username || "Howie",
        text: memoryCommand.reply,
        timestamp: sent.date,
        isGroup,
      });
      console.log(`Household memory replied to ${chatId}: ${memoryCommand.reply.slice(0, 100)}`);
    }
    return;
  }

  // LLM reply (OpenClaw family bot) — for both group and direct messages
  if (!LLM_URL) return;

  try {
    const res = await fetch(LLM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(WORKER_AUTH_TOKEN
          ? { Authorization: `Bearer ${WORKER_AUTH_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({ query: msg.text }),
    });

    if (!res.ok) {
      console.error(
        `LLM returned ${res.status}` +
          (res.status === 401 && !WORKER_AUTH_TOKEN
            ? " — worker requires AUTH_TOKEN; set WORKER_AUTH_TOKEN env var on the bridge."
            : ""),
      );
      return;
    }

    const data = await res.json();
    const reply = data.text || data.response || "";

    if (reply) {
      const sent = await bot.sendMessage(msg.chat.id, reply, {
        reply_to_message_id: msg.message_id,
      });
      pushThreadMessage({
        id: `${chatId}:${sent.message_id}`,
        chatId,
        messageId: sent.message_id,
        direction: "outgoing",
        sender: botInfo?.first_name || botInfo?.username || "Howie",
        text: reply,
        timestamp: sent.date,
        isGroup,
      });
      console.log(`Replied to ${chatId}: ${reply.slice(0, 100)}`);
    }
  } catch (err) {
    console.error("LLM request failed:", err.message);
  }
});

// --- HTTP API ---

const app = express();
app.use(express.json());
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-OpenClaw-Bridge-Token");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  next();
});
app.options("*", (_req, res) => res.sendStatus(204));

app.get("/status", (_req, res) => {
  res.json({
    ready,
    user: botInfo?.id ?? null,
    name: botInfo?.username ?? null,
    polling: TELEGRAM_POLLING,
  });
});

app.post("/send", async (req, res) => {
  if (!ready) return res.status(503).json({ error: "Telegram not connected" });

  const { chatId, message } = req.body;
  if (!chatId || !message) {
    return res.status(400).json({ error: "chatId and message required" });
  }

  try {
    const sent = await bot.sendMessage(chatId, message);
    pushThreadMessage({
      id: `${String(sent.chat.id)}:${sent.message_id}`,
      chatId: String(sent.chat.id),
      messageId: sent.message_id,
      direction: "outgoing",
      sender: botInfo?.first_name || botInfo?.username || "Howie",
      text: message,
      timestamp: sent.date,
      isGroup: sent.chat.type === "group" || sent.chat.type === "supergroup",
    });
    console.log(`Sent to ${sent.chat.id}: ${String(message).slice(0, 100)}`);
    res.json({ ok: true, chatId: String(sent.chat.id), messageId: sent.message_id });
  } catch (err) {
    console.error("Send failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/voice-inbound", (req, res) => {
  const { chatId, message } = req.body;
  if (!chatId || !message) {
    return res.status(400).json({ error: "chatId and message required" });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  pushThreadMessage({
    id: `voice:${chatId}:${timestamp}`,
    chatId: String(chatId),
    direction: "incoming",
    sender: "Peter",
    text: String(message),
    timestamp,
    isGroup: false,
    source: "voice-transcription",
  });
  runOpenClawAgent(String(chatId), String(message));
  console.log(`Voice inbound for ${chatId}: ${String(message).slice(0, 100)}`);
  res.json({ ok: true, queued: true, chatId: String(chatId) });
});

app.post("/knowledge-json", async (req, res) => {
  if (!bridgeAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await completeKnowledgeJson({
      messages: req.body?.messages,
      temperature: req.body?.temperature,
      maxTokens: req.body?.maxTokens,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("Knowledge bridge completion failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/knowledge-feedback", async (req, res) => {
  if (!bridgeAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const record = appendKnowledgeFeedbackFlag({
      targetLogRowId: req.body?.target_log_row_id,
      queryText: req.body?.query_text,
      flaggedAt: req.body?.flagged_at,
      flagType: req.body?.flag_type,
      imageSourceType: req.body?.image_source_type,
      imageRef: req.body?.image_ref,
    });
    res.json({ ok: true, record });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/ask-query", async (req, res) => {
  const query = String(req.body?.query || "").trim();
  if (!query) {
    return res.status(400).json({ error: "query required" });
  }

  try {
    const response = await askWorkerKnowledgePipeline(query);
    if (response) {
      console.log(`Ask query handled by worker knowledge pipeline: ${query.slice(0, 100)}`);
      return res.json({ ok: true, response, store: { stored: true }, via: "worker" });
    }
  } catch (err) {
    console.error("Worker knowledge pipeline failed; falling back to router:", err.message);
  }

  try {
    const { route } = await loadRouter();
    const routerResult = await route(query, {
      systemPrompt: KNOWLEDGE_SYSTEM_PROMPT,
      temperature: 0.2,
      maxTokens: 2048,
    });
    const response = parseKnowledgeResponse(query, routerResult);
    let storeResult = { stored: false };
    try {
      storeResult = await storeKnowledgeResponse(response);
    } catch (err) {
      console.error("Failed to store routed LLM response:", err.message);
    }

    console.log(
      `Ask query routed via ${response.tier || "unknown"} ` +
        `(${response.model || "no model"}): ${query.slice(0, 100)}`,
    );
    res.json({ ok: true, response, store: storeResult });
  } catch (err) {
    console.error("Ask query routing failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/thread", (req, res) => {
  const chatId = req.query.chatId ? String(req.query.chatId) : "";
  const includeGroups = req.query.includeGroups === "true";
  const limit = Math.max(1, Math.min(parseInt(req.query.limit || "8", 10) || 8, 25));
  const liveMessages = recentThread
    .filter((m) => (!chatId || m.chatId === chatId) && (includeGroups || !m.isGroup))
    .slice(-limit);
  const sessionMessages = includeGroups ? [] : openClawThreadMessages(chatId, limit);
  const messages = mergeThreadMessages(sessionMessages, liveMessages).slice(-limit);

  res.json({
    messages,
    ready,
    user: botInfo?.id ?? null,
    name: botInfo?.username ?? null,
  });
});

// --- Homer CI message polling ---
// Returns unacknowledged messages for Homer CI to process

app.get("/messages", (_req, res) => {
  const unacked = messageQueue.filter((m) => !m.ack);
  res.json({ messages: unacked });
});

app.post("/messages/ack", (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: "ids array required" });
  }
  let count = 0;
  for (const msg of messageQueue) {
    if (ids.includes(msg.id)) {
      msg.ack = true;
      count++;
    }
  }
  res.json({ ok: true, acknowledged: count });
});

// --- Start ---

app.listen(PORT, () => {
  console.log(`OpenClaw API listening on http://localhost:${PORT}`);
  console.log(`Connecting to Telegram (${TELEGRAM_POLLING ? "polling" : "send-only"})...`);
});
