import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyMemoryUpdate } from "./applyMemoryUpdate.js";
import { loadHouseholdMemory } from "./loadHouseholdMemory.js";
import { getMemorySource, queryHouseholdMemory } from "./queryHouseholdMemory.js";
import {
  MEMORY_CATEGORIES,
  REQUIRED_DISALLOWED_USES,
  HouseholdMemoryValidationError,
  createMemoryItem,
} from "./schema.js";

const NOW = "2026-05-20T22:00:00.000Z";

let rootDir;

beforeEach(() => {
  rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "home-center-household-memory-"));
  for (const category of MEMORY_CATEGORIES) {
    fs.writeFileSync(path.join(rootDir, `${category}.json`), "[]\n");
  }
  fs.writeFileSync(path.join(rootDir, "sources.jsonl"), "");
  fs.writeFileSync(path.join(rootDir, "corrections.jsonl"), "");
});

afterEach(() => {
  fs.rmSync(rootDir, { recursive: true, force: true });
});

describe("household memory", () => {
  it("loads valid skeleton memory deterministically", () => {
    const memory = loadHouseholdMemory({ rootDir });

    expect(Object.keys(memory.categories)).toEqual(MEMORY_CATEGORIES);
    expect(memory.categories.people).toEqual([]);
    expect(memory.sources).toEqual([]);
    expect(memory.corrections).toEqual([]);
  });

  it("rejects invalid memory items with missing source", () => {
    fs.writeFileSync(
      path.join(rootDir, "people.json"),
      JSON.stringify([
        {
          id: "hm_people_emma_grade",
          type: "person",
          subject: "Example Child",
          claim: "Example Child is in fourth grade.",
          confidence: "user_confirmed",
          created_at: NOW,
          updated_at: NOW,
          valid_from: NOW,
          valid_until: null,
          status: "active",
          allowed_uses: ["conversation"],
          disallowed_uses: REQUIRED_DISALLOWED_USES,
        },
      ]),
    );

    expect(() => loadHouseholdMemory({ rootDir })).toThrow(HouseholdMemoryValidationError);
  });

  it("queries by type, subject, and free text", () => {
    remember("preferences", exampleItem({ id: "hm_preferences_snack", type: "preference", subject: "Example Kid", claim: "Example Kid likes apples." }));
    remember("people", exampleItem({ id: "hm_people_grade", type: "person", subject: "Example Kid", claim: "Example Kid is in fourth grade." }));

    const memory = loadHouseholdMemory({ rootDir });

    expect(queryHouseholdMemory(memory, { type: "preference" }).map((item) => item.id)).toEqual([
      "hm_preferences_snack",
    ]);
    expect(queryHouseholdMemory(memory, { subject: "Example Kid" }).map((item) => item.id)).toEqual([
      "hm_people_grade",
      "hm_preferences_snack",
    ]);
    expect(queryHouseholdMemory(memory, { text: "apples" }).map((item) => item.id)).toEqual([
      "hm_preferences_snack",
    ]);
  });

  it("corrects an existing fact and appends an audit event", () => {
    remember("school", exampleItem({ id: "hm_school_grade_old", type: "school", subject: "Example Kid", claim: "Example Kid is in third grade." }));

    applyMemoryUpdate(
      {
        action: "correct",
        itemId: "hm_school_grade_old",
        reason: "User corrected the grade.",
        replacement: exampleItem({
          id: "hm_school_grade_new",
          type: "school",
          subject: "Example Kid",
          claim: "Example Kid is in fourth grade.",
        }),
      },
      { rootDir, now: "2026-05-20T22:10:00.000Z" },
    );

    const memory = loadHouseholdMemory({ rootDir });
    expect(queryHouseholdMemory(memory, { category: "school" }).map((item) => item.id)).toEqual([
      "hm_school_grade_new",
    ]);
    expect(queryHouseholdMemory(memory, { category: "school", includeInactive: true }).map((item) => item.status).sort()).toEqual([
      "active",
      "corrected",
    ]);
    expect(memory.corrections).toEqual([
      expect.objectContaining({
        event: "correct",
        old_item_id: "hm_school_grade_old",
        new_item_id: "hm_school_grade_new",
      }),
    ]);
  });

  it("soft-deactivates forgotten memory and keeps the audit trail", () => {
    remember("places", exampleItem({ id: "hm_places_pool", type: "place", subject: "Example Pool", claim: "Example Pool is near the library." }));

    applyMemoryUpdate(
      {
        action: "forget",
        itemId: "hm_places_pool",
        reason: "No longer useful.",
        source: source("user_request", "telegram:test-forget"),
      },
      { rootDir, now: "2026-05-20T22:20:00.000Z" },
    );

    const memory = loadHouseholdMemory({ rootDir });
    expect(queryHouseholdMemory(memory, { category: "places" })).toEqual([]);
    expect(queryHouseholdMemory(memory, { category: "places", includeInactive: true })[0]).toEqual(
      expect.objectContaining({ id: "hm_places_pool", status: "inactive" }),
    );
    expect(memory.corrections[0]).toEqual(expect.objectContaining({ event: "forget", item_id: "hm_places_pool" }));
  });

  it("enforces allowed and disallowed use boundaries", () => {
    const unsafe = {
      id: "hm_facts_unsafe",
      type: "fact",
      subject: "Dashboard",
      claim: "Unsafe item.",
      source: source("user_request", "telegram:test"),
      confidence: "user_confirmed",
      created_at: NOW,
      updated_at: NOW,
      valid_from: NOW,
      valid_until: null,
      status: "active",
      allowed_uses: ["conversation", "card_visibility_without_derived_state"],
      disallowed_uses: REQUIRED_DISALLOWED_USES,
    };

    expect(() => remember("facts", unsafe)).toThrow(HouseholdMemoryValidationError);
  });

  it("allows dashboard context only as non-decisive context", () => {
    remember(
      "facts",
      exampleItem({
        id: "hm_facts_dashboard_context",
        type: "fact",
        subject: "Dashboard",
        claim: "Use this only as explanation context.",
        allowed_uses: ["conversation", "explanation", "dashboard_context"],
      }),
    );

    const [item] = queryHouseholdMemory(loadHouseholdMemory({ rootDir }), { text: "explanation context" });

    expect(item.allowed_uses).toContain("dashboard_context");
    expect(item.disallowed_uses).toEqual(expect.arrayContaining(REQUIRED_DISALLOWED_USES));
  });

  it("looks up the source for a memory item", () => {
    remember("routines", exampleItem({ id: "hm_routines_bedtime", type: "routine", subject: "Example Routine", claim: "Example bedtime is 8 PM." }));

    const memory = loadHouseholdMemory({ rootDir });

    expect(getMemorySource(memory, "hm_routines_bedtime")).toEqual(source("user_request", "telegram:test"));
  });

  it("does not partially write a correction that fails validation", () => {
    remember("facts", exampleItem({ id: "hm_facts_original", type: "fact", subject: "Example", claim: "Original claim." }));
    const beforeFacts = fs.readFileSync(path.join(rootDir, "facts.json"), "utf8");
    const beforeCorrections = fs.readFileSync(path.join(rootDir, "corrections.jsonl"), "utf8");

    expect(() =>
      applyMemoryUpdate(
        {
          action: "correct",
          itemId: "hm_facts_original",
          replacement: {
            id: "hm_facts_bad",
            type: "fact",
            subject: "Example",
            claim: "Bad correction.",
            source: source("user_request", "telegram:test"),
            confidence: "user_confirmed",
            created_at: NOW,
            updated_at: NOW,
            valid_from: NOW,
            valid_until: null,
            status: "active",
            allowed_uses: ["conversation"],
            disallowed_uses: ["card_visibility_without_derived_state"],
          },
        },
        { rootDir, now: "2026-05-20T22:30:00.000Z" },
      ),
    ).toThrow(HouseholdMemoryValidationError);

    expect(fs.readFileSync(path.join(rootDir, "facts.json"), "utf8")).toBe(beforeFacts);
    expect(fs.readFileSync(path.join(rootDir, "corrections.jsonl"), "utf8")).toBe(beforeCorrections);
  });
});

function remember(category, item) {
  return applyMemoryUpdate({ action: "remember", category, item }, { rootDir, now: NOW });
}

function exampleItem(overrides = {}) {
  return createMemoryItem({
    id: overrides.id,
    type: overrides.type || "fact",
    subject: overrides.subject || "Example Subject",
    claim: overrides.claim || "Example claim.",
    source: overrides.source || source("user_request", "telegram:test"),
    confidence: overrides.confidence || "user_confirmed",
    created_at: overrides.created_at || NOW,
    updated_at: overrides.updated_at || NOW,
    valid_from: overrides.valid_from || NOW,
    valid_until: overrides.valid_until ?? null,
    status: overrides.status || "active",
    allowed_uses: overrides.allowed_uses || ["conversation", "suggestion", "explanation"],
    disallowed_uses: overrides.disallowed_uses || REQUIRED_DISALLOWED_USES,
  });
}

function source(kind, ref) {
  return { kind, ref, captured_at: NOW };
}
