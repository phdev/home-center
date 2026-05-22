import { describe, it, expect } from "vitest";
import { normalizeSchoolItems } from "./schoolUpdates";

describe("normalizeSchoolItems", () => {
  it("returns [] on empty input", () => {
    expect(normalizeSchoolItems(null)).toEqual([]);
    expect(normalizeSchoolItems({})).toEqual([]);
    expect(normalizeSchoolItems({ items: [] })).toEqual([]);
  });

  it("accepts updates[] as an alias for items[]", () => {
    const r = normalizeSchoolItems({
      updates: [{ title: "Permission slip", kind: "action" }],
    });
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe("action");
  });

  it("coerces unknown kind to 'info'", () => {
    const r = normalizeSchoolItems({ items: [{ title: "x", kind: "banana" }] });
    expect(r[0].kind).toBe("info");
  });

  it("maps kind aliases via substring match", () => {
    const r = normalizeSchoolItems({
      items: [
        { title: "a", kind: "action-item" },
        { title: "b", kind: "gentle reminder" },
        { title: "c", kind: "field trip event" },
      ],
    });
    expect(r.map((x) => x.kind)).toEqual(["action", "reminder", "event"]);
  });

  it("clamps urgency into [0,1]", () => {
    const r = normalizeSchoolItems({
      items: [
        { title: "a", urgency: -0.5 },
        { title: "b", urgency: 2 },
        { title: "c", urgency: 99 },
        { title: "d", urgency: 0.5 },
      ],
    });
    expect(r[0].urgency).toBe(0);
    expect(r[1].urgency).toBe(1);
    expect(r[2].urgency).toBe(1);
    expect(r[3].urgency).toBeCloseTo(0.5);
  });

  it("infers urgency from language when not supplied", () => {
    const r = normalizeSchoolItems({
      items: [
        { title: "Reminder: due today", body: "" },
        { title: "Field trip next week", body: "" },
        { title: "Yearbook photos due Friday", body: "" },
      ],
    });
    expect(r[0].urgency).toBeGreaterThanOrEqual(0.7);
    expect(r[1].urgency).toBeLessThan(0.7);
    expect(r[2].urgency).toBeGreaterThan(0.3);
  });

  it("tags extractionSource based on classifier hint", () => {
    const r = normalizeSchoolItems({
      items: [
        { title: "a", classifier: "llm" },
        { title: "b" },
      ],
    });
    expect(r[0].extractionSource).toBe("openclaw");
    expect(r[1].extractionSource).toBe("regex");
  });

  it("truncates body → summary when summary missing", () => {
    const body = "x".repeat(500);
    const r = normalizeSchoolItems({ items: [{ title: "t", body }] });
    expect(r[0].summary.length).toBeLessThanOrEqual(160);
  });
});
