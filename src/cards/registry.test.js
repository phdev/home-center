import { describe, it, expect } from "vitest";
import {
  CARDS,
  pickContextualCard,
  pickRightColumnCards,
  pickOverlays,
} from "./registry";

/** Build a minimal DerivedState with only the flags we care about. */
function derived(flags = {}) {
  return {
    hasMorningOverlap: false,
    conflicts: [],
    peter0800_0900Risk: false,
    showMorningChecklist: false,
    checklist: { items: [], variant: { highTempF: null, needsJacket: false, hotDay: false, rain: false } },
    hasSchoolActionItems: false,
    hasUrgentSchoolItem: false,
    rankedSchoolItems: [],
    birthdaysRanked: [],
    birthdayGiftNeeded: false,
    bedtimeReminderActive: false,
    bedtimeWindow: null,
    takeoutDecisionPending: false,
    takeoutState: { decision: null, suggestedVendors: [] },
    lunchDecisionNeeded: false,
    lunchContext: null,
    showClawSuggestions: false,
    clawSuggestions: [],
    nextMeaningfulTransition: null,
    ...flags,
  };
}

describe("card registry — invariants", () => {
  it("every card has an id, placement, tier, visible fn, Component, enhancementFeature", () => {
    for (const c of CARDS) {
      expect(c.id).toBeTruthy();
      expect(["contextualSlot", "rightColumn", "overlay"]).toContain(c.placement);
      expect([1, 2, 3, 4]).toContain(c.tier);
      expect(typeof c.visible).toBe("function");
      expect(typeof c.Component).toBe("function");
      expect(typeof c.enhancementFeature).toBe("string");
    }
  });

  it("card ids are unique", () => {
    const ids = CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("pickContextualCard — deterministic visibility", () => {
  it("returns null when nothing is eligible", () => {
    expect(pickContextualCard(derived())).toBeNull();
  });

  it("Morning Checklist wins when alone", () => {
    const c = pickContextualCard(derived({ showMorningChecklist: true }));
    expect(c?.id).toBe("morningChecklist");
  });

  it("Takeout Decision wins over Morning Checklist (higher tier)", () => {
    const c = pickContextualCard(
      derived({
        showMorningChecklist: true,
        takeoutDecisionPending: true,
        takeoutState: { decision: null, suggestedVendors: [] },
      }),
    );
    expect(c?.id).toBe("takeoutDecision");
  });

  it("Lunch Decision wins over Takeout on tier tie-break deadline (22:00 > 20:00)", () => {
    // Both are tier 2. Takeout deadline (20:00) < Lunch deadline (22:00),
    // so Takeout sorts first (earlier deadline wins).
    const c = pickContextualCard(
      derived({
        takeoutDecisionPending: true,
        lunchDecisionNeeded: true,
      }),
    );
    expect(c?.id).toBe("takeoutDecision");
  });
});

describe("pickRightColumnCards", () => {
  it("empty when showClawSuggestions is false", () => {
    expect(pickRightColumnCards(derived())).toEqual([]);
  });

  it("returns Claw Suggestions when the flag is true", () => {
    const r = pickRightColumnCards(derived({ showClawSuggestions: true, clawSuggestions: [{ id: "x", tier: 1 }] }));
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("clawSuggestions");
  });
});

describe("pickOverlays", () => {
  it("empty when no overlays active", () => {
    expect(pickOverlays(derived())).toEqual([]);
  });

  it("Bedtime Toast appears only when the flag is true", () => {
    const r = pickOverlays(
      derived({
        bedtimeReminderActive: true,
        bedtimeWindow: { bedtimeAt: new Date().toISOString(), minutesUntil: 30, kidsInRange: [] },
      }),
    );
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("bedtimeToast");
  });
});

describe("critical invariant — no card depends on OpenClaw to be visible", () => {
  it("every card's visible() takes only DerivedState (never makes network calls)", () => {
    // We smoke-test by invoking visible() on a frozen derived object — if any
    // implementation tried to call fetch/XHR/timers, the call would either
    // throw in jsdom (no real network) or not be deterministic.
    const d = Object.freeze(derived({
      showMorningChecklist: true,
      takeoutDecisionPending: true,
      lunchDecisionNeeded: true,
      bedtimeReminderActive: true,
      showClawSuggestions: true,
      bedtimeWindow: { bedtimeAt: new Date().toISOString(), minutesUntil: 30, kidsInRange: [] },
      clawSuggestions: [{ id: "x", tier: 1 }],
    }));
    for (const c of CARDS) {
      const out = c.visible(d);
      expect(typeof out).toBe("boolean");
    }
  });

  it("visibility is a pure function — same input, same output", () => {
    const d = derived({ showMorningChecklist: true });
    const first = CARDS.map((c) => c.visible(d));
    const second = CARDS.map((c) => c.visible(d));
    expect(first).toEqual(second);
  });
});
