import { describe, it, expect } from "vitest";
import {
  guessKind,
  guessUrgency,
  extractDueDate,
  dedupeSemantic,
} from "./schoolHeuristics";

describe("guessKind (pre-LLM)", () => {
  it("returns 'action' for sign/bring/rsvp/pay verbs", () => {
    expect(guessKind("Please sign the permission slip and return it.")).toBe("action");
    expect(guessKind("Bring a snack for class party")).toBe("action");
    expect(guessKind("RSVP for the field trip")).toBe("action");
    expect(guessKind("Lunch account balance — please pay $12")).toBe("action");
  });

  it("returns 'event' for dated social happenings", () => {
    expect(guessKind("Spring Book Fair April 18th")).toBe("event");
    expect(guessKind("Parent-teacher conferences next Thursday")).toBe("event");
  });

  it("returns 'reminder' for pure memory prompts", () => {
    expect(guessKind("Reminder: library books are due Monday")).toBe("reminder");
    expect(guessKind("Don't forget picture day tomorrow")).toBe("reminder");
  });

  it("returns 'info' for newsletters / updates without action or date", () => {
    expect(guessKind("Newsletter — this week in Ms. Rhodes' class")).toBe("info");
    expect(guessKind("Principal message: hello families")).toBe("info");
  });

  it("is case-insensitive", () => {
    expect(guessKind("PLEASE SIGN and RETURN")).toBe("action");
  });
});

describe("guessUrgency (pre-LLM)", () => {
  it("scores ≥ 0.7 for today/tomorrow/urgent", () => {
    expect(guessUrgency({ title: "Due today" }).score).toBeGreaterThanOrEqual(0.7);
    expect(guessUrgency({ title: "", body: "Urgent: sign by tonight" }).score).toBeGreaterThanOrEqual(0.7);
    expect(guessUrgency({ title: "Permission slip due tomorrow" }).score).toBeGreaterThanOrEqual(0.7);
  });

  it("scores moderate for this-week language", () => {
    const s = guessUrgency({ title: "Due this Friday" }).score;
    expect(s).toBeGreaterThanOrEqual(0.5);
    expect(s).toBeLessThan(0.8);
  });

  it("scores low for background info", () => {
    expect(guessUrgency({ title: "Weekly newsletter" }).score).toBeLessThanOrEqual(0.4);
  });

  it("returns a matchingReason so callers can explain the score", () => {
    const out = guessUrgency({ title: "Due today" });
    expect(out.reason).toBeTruthy();
  });
});

describe("extractDueDate (pre-LLM)", () => {
  const now = new Date("2026-04-19T12:00:00"); // Sunday

  it("returns null when no date cue is present", () => {
    expect(extractDueDate("Just saying hi", now)).toBeNull();
  });

  it("parses 'due MM/DD' (current year if not past)", () => {
    const r = extractDueDate("Please sign and return due 4/24", now);
    expect(r).not.toBeNull();
    expect(r.getMonth()).toBe(3); // April
    expect(r.getDate()).toBe(24);
    expect(r.getFullYear()).toBe(2026);
  });

  it("parses 'due MM/DD' rolling to next year if in the past", () => {
    const winter = new Date("2026-12-20T12:00:00");
    const r = extractDueDate("due 1/15", winter);
    expect(r.getFullYear()).toBe(2027);
    expect(r.getMonth()).toBe(0);
  });

  it("parses 'due today'", () => {
    const r = extractDueDate("forms due today", now);
    expect(r).not.toBeNull();
    expect(r.toDateString()).toBe(now.toDateString());
  });

  it("parses 'due tomorrow'", () => {
    const r = extractDueDate("please return tomorrow", now);
    expect(r).not.toBeNull();
    expect(r.getDate()).toBe(20);
  });

  it("parses 'due Friday' (next occurrence)", () => {
    const r = extractDueDate("turn in by Friday", now);
    expect(r).not.toBeNull();
    expect(r.getDay()).toBe(5);
    // Sunday → the coming Friday (5 days later)
    expect(r.getDate()).toBe(24);
  });

  it("returns the earliest matching cue when multiple present", () => {
    const r = extractDueDate("deadline today, latest Friday", now);
    expect(r.toDateString()).toBe(now.toDateString());
  });
});

describe("dedupeSemantic", () => {
  it("returns all items when none look similar", () => {
    const items = [
      { id: "a", title: "Science fair waiver", summary: "sign and return" },
      { id: "b", title: "Book fair volunteers", summary: "sign up" },
    ];
    expect(dedupeSemantic(items)).toHaveLength(2);
  });

  it("collapses items with near-identical titles", () => {
    const items = [
      { id: "a", title: "Science fair waiver", summary: "sign and return", sourceEmailId: "e1", receivedAt: "2026-04-17T12:00:00Z" },
      { id: "b", title: "Science fair waiver (reminder)", summary: "please sign", sourceEmailId: "e2", receivedAt: "2026-04-18T12:00:00Z" },
    ];
    const out = dedupeSemantic(items);
    expect(out).toHaveLength(1);
    // Newest item wins; older item is referenced as 'supersededBy' or similar.
    expect(out[0].id).toBe("b");
  });

  it("preserves items whose titles merely share a word", () => {
    const items = [
      { id: "a", title: "Field trip permission slip" },
      { id: "b", title: "Field day on Friday" },
    ];
    expect(dedupeSemantic(items)).toHaveLength(2);
  });
});
