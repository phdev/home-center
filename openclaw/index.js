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
import { parseArgs } from "node:util";

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
const TELEGRAM_POLLING = process.env.TELEGRAM_POLLING !== "false";

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

  // Queue all non-group messages for Homer CI to poll
  if (!isGroup) {
    messageQueue.push({
      id: `${chatId}:${msg.message_id}`,
      from: chatId,
      body: msg.text,
      timestamp: msg.date,
      ack: false,
    });
    while (messageQueue.length > MAX_QUEUE) messageQueue.shift();
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
      await bot.sendMessage(msg.chat.id, reply, {
        reply_to_message_id: msg.message_id,
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
    res.json({ ok: true, chatId: String(sent.chat.id), messageId: sent.message_id });
  } catch (err) {
    console.error("Send failed:", err.message);
    res.status(500).json({ error: err.message });
  }
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
