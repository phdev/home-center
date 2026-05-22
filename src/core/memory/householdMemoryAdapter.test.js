import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  handleHouseholdMemoryCommand,
  parseHouseholdMemoryCommand,
} from "./householdMemoryAdapter.js";
import { loadHouseholdMemory } from "./loadHouseholdMemory.js";
import { MEMORY_CATEGORIES } from "./schema.js";

const NOW = "2026-05-20T22:30:00.000Z";
const SOURCE = { kind: "user_request", ref: "telegram:169", captured_at: NOW };

let rootDir;

beforeEach(() => {
  rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "home-center-household-memory-adapter-"));
  for (const category of MEMORY_CATEGORIES) {
    fs.writeFileSync(path.join(rootDir, `${category}.json`), "[]\n");
  }
  fs.writeFileSync(path.join(rootDir, "sources.jsonl"), "");
  fs.writeFileSync(path.join(rootDir, "corrections.jsonl"), "");
});

afterEach(() => {
  fs.rmSync(rootDir, { recursive: true, force: true });
});

describe("household memory command adapter", () => {
  it("parses explicit memory commands only", () => {
    expect(parseHouseholdMemoryCommand("remember that Olivia likes mango")).toEqual({
      action: "remember",
      claim: "Olivia likes mango",
    });
    expect(parseHouseholdMemoryCommand("what do you remember about Olivia?")).toEqual({
      action: "recall",
      text: "Olivia",
    });
    expect(parseHouseholdMemoryCommand("show the dashboard")).toBeNull();
  });

  it("remembers explicit facts with source and dashboard-safe use limits", () => {
    const result = handleHouseholdMemoryCommand(
      "remember that Olivia likes mango after school",
      { source: SOURCE },
      { rootDir, now: NOW },
    );

    expect(result).toEqual(expect.objectContaining({ handled: true, action: "remember", status: "ok" }));
    expect(result.category).toBe("preferences");
    expect(result.item).toEqual(expect.objectContaining({
      subject: "Olivia",
      claim: "Olivia likes mango after school",
      source: SOURCE,
      allowed_uses: ["conversation", "suggestion", "explanation"],
    }));
    expect(result.item.disallowed_uses).toEqual(expect.arrayContaining([
      "card_visibility_without_derived_state",
      "reminder_timing_without_derived_state",
      "priority_without_intervention_engine",
    ]));
  });

  it("recalls matching memory without mutating it", () => {
    handleHouseholdMemoryCommand("remember that Lucy likes blueberries", { source: SOURCE }, { rootDir, now: NOW });
    const before = loadHouseholdMemory({ rootDir });

    const result = handleHouseholdMemoryCommand("what do you remember about Lucy?", {}, { rootDir, now: NOW });

    expect(result.status).toBe("ok");
    expect(result.items.map((item) => item.claim)).toEqual(["Lucy likes blueberries"]);
    expect(loadHouseholdMemory({ rootDir })).toEqual(before);
  });

  it("explains where a memory item came from", () => {
    const remembered = handleHouseholdMemoryCommand(
      "remember that Jefferson has minimum day on Friday",
      { source: SOURCE },
      { rootDir, now: NOW },
    );

    const result = handleHouseholdMemoryCommand(
      "where did you learn that?",
      { lastMemoryItemId: remembered.item.id },
      { rootDir, now: NOW },
    );

    expect(result).toEqual(expect.objectContaining({
      handled: true,
      action: "source",
      status: "ok",
      source: SOURCE,
    }));
  });

  it("soft-forgets matching memory through the service layer", () => {
    const remembered = handleHouseholdMemoryCommand(
      "remember that Example Pool is near the library",
      { source: SOURCE },
      { rootDir, now: NOW },
    );

    const result = handleHouseholdMemoryCommand(
      "forget that Example Pool is near the library",
      { source: SOURCE },
      { rootDir, now: "2026-05-20T22:45:00.000Z" },
    );

    expect(result).toEqual(expect.objectContaining({ action: "forget", status: "ok" }));
    const memory = loadHouseholdMemory({ rootDir });
    expect(memory.categories[remembered.category][0]).toEqual(expect.objectContaining({
      id: remembered.item.id,
      status: "inactive",
    }));
    expect(memory.corrections[0]).toEqual(expect.objectContaining({ event: "forget", item_id: remembered.item.id }));
  });

  it("corrects one matching memory and keeps correction history", () => {
    const remembered = handleHouseholdMemoryCommand(
      "remember that Olivia is in second grade",
      { source: SOURCE },
      { rootDir, now: NOW },
    );

    const result = handleHouseholdMemoryCommand(
      "correct Olivia is in second grade to Olivia is in third grade",
      { source: SOURCE },
      { rootDir, now: "2026-05-20T22:50:00.000Z" },
    );

    expect(result).toEqual(expect.objectContaining({ action: "correct", status: "ok" }));
    expect(result.item.claim).toBe("Olivia is in third grade");
    const memory = loadHouseholdMemory({ rootDir });
    expect(memory.categories[remembered.category].map((item) => item.status).sort()).toEqual(["active", "corrected"]);
    expect(memory.corrections[0]).toEqual(expect.objectContaining({
      event: "correct",
      old_item_id: remembered.item.id,
      new_item_id: result.item.id,
    }));
  });
});
