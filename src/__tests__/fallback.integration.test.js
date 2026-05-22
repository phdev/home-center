/**
 * Integration-level guarantee: raw input → derived state → card visibility.
 * This test exists to enforce the architectural invariant that no card
 * depends on OpenClaw to appear.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { computeDerivedState, emptyRawState } from "../state/deriveState";
import {
  pickContextualCard,
  pickOverlays,
  pickRightColumnCards,
} from "../cards/registry";
import { enhance } from "../ai/openclaw";

function at(y, m, d, h, min = 0) {
  return new Date(y, m - 1, d, h, min, 0, 0);
}

afterEach(() => vi.restoreAllMocks());

describe("integration — no card depends on OpenClaw for visibility", () => {
  it("bedtime window: card visible with enhancer returning fallback", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));
    const raw = {
      ...emptyRawState(),
      bedtime: [
        { childId: "emma", childName: "Emma", weekday: "20:30", weekend: "21:00", reminderLeadMin: 30 },
      ],
    };
    const derived = computeDerivedState(raw, { now: at(2026, 4, 23, 20, 10), user: { isPeter: true } });
    const overlays = pickOverlays(derived);
    expect(overlays.some((c) => c.id === "bedtimeToast")).toBe(true);
    // And the enhancer falls back:
    const r = await enhance({ feature: "bedtime", state: derived.bedtimeWindow }, { url: "http://worker" });
    expect(r.source).toBe("fallback");
  });

  it("takeout decision: card visible after 16:30 regardless of AI", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));
    const derived = computeDerivedState(emptyRawState(), {
      now: at(2026, 4, 23, 17, 0),
      user: { isPeter: true },
    });
    const picked = pickContextualCard(derived);
    expect(picked?.id).toBe("takeoutDecision");
  });

  it("morning checklist: card visible without AI, items supplied", () => {
    const raw = {
      ...emptyRawState(),
      checklist: {
        items: [
          { id: "sunscreen", label: "Sunscreen on", condition: "always" },
          { id: "shorts", label: "Shorts", condition: "hot" },
        ],
      },
      weather: { today: { highTempF: 86, lowTempF: 70, precipProb: 0, summary: "" } },
    };
    const derived = computeDerivedState(raw, { now: at(2026, 4, 23, 7, 30), user: { isPeter: true } });
    expect(derived.showMorningChecklist).toBe(true);
    expect(derived.checklist.items.map((i) => i.id)).toEqual(["sunscreen", "shorts"]);
    const picked = pickContextualCard(derived);
    expect(picked?.id).toBe("morningChecklist");
  });

  it("claw suggestions: ranked list available without AI but redundant card is suppressed", () => {
    const raw = {
      ...emptyRawState(),
      birthdays: [{ id: "b", name: "Mom", date: "05-01", giftStatus: "unknown" }],
    };
    const derived = computeDerivedState(raw, { now: at(2026, 4, 19, 10), user: { isPeter: true } });
    expect(derived.clawSuggestions.length).toBeGreaterThanOrEqual(1);
    const right = pickRightColumnCards(derived);
    expect(right.some((c) => c.id === "clawSuggestions")).toBe(false);
  });

  it("no card visibility function reads network / globals", () => {
    // We explicitly freeze the derived object and remove fetch during this
    // test — if any visibility function tried to call fetch, it would throw.
    vi.stubGlobal("fetch", () => {
      throw new Error("visibility must not touch network");
    });
    const derived = Object.freeze(
      computeDerivedState(emptyRawState(), { now: new Date(), user: { isPeter: true } }),
    );
    // These must not throw.
    pickContextualCard(derived);
    pickOverlays(derived);
    pickRightColumnCards(derived);
  });
});
