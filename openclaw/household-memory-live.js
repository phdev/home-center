import {
  handleHouseholdMemoryCommand,
  parseHouseholdMemoryCommand,
} from "../src/core/memory/householdMemoryAdapter.js";

export function createHouseholdMemoryLiveHandler(options = {}) {
  const contexts = options.contexts || new Map();
  const rootDir = options.rootDir;
  const now = options.now;

  return function handleLiveHouseholdMemoryCommand(message) {
    const text = String(message?.text || "").trim();
    if (message?.isGroup && !hasHowiePrefix(text)) {
      return { handled: false, passthrough: text };
    }

    const command = parseHouseholdMemoryCommand(text);
    if (!command) return { handled: false, passthrough: text };

    try {
      const chatId = String(message?.chatId || "");
      const contextKey = chatId || "default";
      const previousContext = contexts.get(contextKey) || {};
      const capturedAt = typeof now === "function" ? now() : now;
      const source = {
        kind: "telegram",
        ref: telegramRef(message),
        captured_at: capturedAt || new Date().toISOString(),
      };

      const result = handleHouseholdMemoryCommand(
        command,
        {
          source,
          lastMemoryItemId: previousContext.lastMemoryItemId,
        },
        {
          rootDir,
          now: source.captured_at,
        },
      );

      const lastMemoryItemId = memoryContextItemId(result);
      if (lastMemoryItemId) {
        contexts.set(contextKey, { lastMemoryItemId });
      }

      return {
        handled: true,
        command,
        result,
        reply: result.message,
      };
    } catch (error) {
      return {
        handled: true,
        command,
        result: {
          handled: true,
          action: command.action,
          status: "error",
          error: String(error?.message || error),
          message: "I could not update household memory safely. Nothing was changed.",
        },
        reply: "I could not update household memory safely. Nothing was changed.",
      };
    }
  };
}

function hasHowiePrefix(text) {
  return /^howie(?:[:,])?\s+/i.test(text);
}

function telegramRef(message) {
  const chatId = String(message?.chatId || "unknown-chat");
  const messageId = message?.messageId || message?.message_id || "unknown-message";
  return `telegram:${chatId}:${messageId}`;
}

function memoryContextItemId(result) {
  if (result?.item?.id) return result.item.id;
  if (Array.isArray(result?.items) && result.items.length === 1 && result.items[0]?.id) {
    return result.items[0].id;
  }
  return "";
}
