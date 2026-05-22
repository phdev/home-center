import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createHouseholdMemoryLiveHandler } from "../../../openclaw/household-memory-live.js";
import { loadHouseholdMemory } from "./loadHouseholdMemory.js";
import { MEMORY_CATEGORIES, REQUIRED_DISALLOWED_USES } from "./schema.js";

const NOW = "2026-05-20T23:00:00.000Z";

let rootDir;
let handleMemory;

beforeEach(() => {
  rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "home-center-household-memory-live-"));
  for (const category of MEMORY_CATEGORIES) {
    fs.writeFileSync(path.join(rootDir, `${category}.json`), "[]\n");
  }
  fs.writeFileSync(path.join(rootDir, "sources.jsonl"), "");
  fs.writeFileSync(path.join(rootDir, "corrections.jsonl"), "");
  handleMemory = createHouseholdMemoryLiveHandler({ rootDir, now: NOW });
});

afterEach(() => {
  fs.rmSync(rootDir, { recursive: true, force: true });
});

describe("live household memory command handling", () => {
  it("intercepts explicit memory commands", () => {
    const response = handleMemory(message("remember that Olivia likes mango"));

    expect(response).toEqual(expect.objectContaining({
      handled: true,
      reply: "Remembered: Olivia likes mango",
    }));
    expect(response.result).toEqual(expect.objectContaining({
      action: "remember",
      status: "ok",
    }));
    expect(response.result.item.source).toEqual({
      kind: "telegram",
      ref: "telegram:123:456",
      captured_at: NOW,
    });
  });

  it("returns a safe error response when a memory write fails", () => {
    fs.writeFileSync(path.join(rootDir, "people.json"), "{not valid json");

    const response = handleMemory(message("remember that Olivia likes mango"));

    expect(response).toEqual(expect.objectContaining({
      handled: true,
      reply: "I could not update household memory safely. Nothing was changed.",
    }));
    expect(response.result).toEqual(expect.objectContaining({
      action: "remember",
      status: "error",
    }));
  });

  it("passes non-memory messages through unchanged", () => {
    const response = handleMemory(message("what's for dinner tonight?"));

    expect(response).toEqual({
      handled: false,
      passthrough: "what's for dinner tonight?",
    });
    expect(allItems()).toEqual([]);
  });

  it("does not intercept bare group-chat memory commands", () => {
    const response = handleMemory(message("remember that Olivia likes mango", { isGroup: true }));

    expect(response).toEqual({
      handled: false,
      passthrough: "remember that Olivia likes mango",
    });
    expect(allItems()).toEqual([]);
  });

  it("intercepts group-chat memory commands with an explicit Howie prefix", () => {
    const response = handleMemory(message("Howie, remember that Olivia likes mango", { isGroup: true }));

    expect(response).toEqual(expect.objectContaining({
      handled: true,
      reply: "Remembered: Olivia likes mango",
    }));
    expect(allItems().map((item) => item.claim)).toEqual(["Olivia likes mango"]);
  });

  it("still intercepts bare direct-message memory commands", () => {
    const response = handleMemory(message("remember that Olivia likes mango"));

    expect(response).toEqual(expect.objectContaining({
      handled: true,
      reply: "Remembered: Olivia likes mango",
    }));
  });

  it("returns ambiguity for correction and forget commands with multiple matches", () => {
    handleMemory(message("remember that Lucy likes blueberries"));
    handleMemory(message("remember that Lucy likes blueberries after dinner"));

    const correction = handleMemory(message("correct Lucy likes blueberries to Lucy likes strawberries"));
    const forget = handleMemory(message("forget Lucy likes blueberries"));

    expect(correction.result).toEqual(expect.objectContaining({
      action: "correct",
      status: "ambiguous",
    }));
    expect(correction.reply).toBe("I found more than one matching household memory item.");
    expect(forget.result).toEqual(expect.objectContaining({
      action: "forget",
      status: "ambiguous",
    }));
    expect(forget.reply).toBe("I found more than one matching household memory item.");
  });

  it("answers source questions only with recent memory context or a clear topic", () => {
    const noContext = handleMemory(message("where did you learn that?"));
    expect(noContext.result).toEqual(expect.objectContaining({
      action: "source",
      status: "needs_context",
    }));

    handleMemory(message("remember that Jefferson has minimum day on Friday"));
    const recentContext = handleMemory(message("where did you learn that?"));
    expect(recentContext.result).toEqual(expect.objectContaining({
      action: "source",
      status: "ok",
    }));
    expect(recentContext.reply).toContain("telegram:123:456");

    const freshHandler = createHouseholdMemoryLiveHandler({ rootDir, now: NOW });
    const clearTopic = freshHandler(message("where did you learn about Jefferson?"));
    expect(clearTopic.result).toEqual(expect.objectContaining({
      action: "source",
      status: "ok",
    }));
  });

  it("keeps dashboard and derived-state boundaries unchanged", () => {
    expect(handleMemory(message("show the dashboard")).handled).toBe(false);

    const response = handleMemory(message("remember that the dashboard can mention snack preferences"));

    expect(response.result.item.allowed_uses).toEqual(["conversation", "suggestion", "explanation"]);
    expect(response.result.item.disallowed_uses).toEqual(expect.arrayContaining(REQUIRED_DISALLOWED_USES));
  });
});

function message(text, overrides = {}) {
  return {
    text,
    chatId: "123",
    messageId: 456,
    ...overrides,
  };
}

function allItems() {
  const memory = loadHouseholdMemory({ rootDir });
  return MEMORY_CATEGORIES.flatMap((category) => memory.categories[category]);
}
