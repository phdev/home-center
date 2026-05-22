import { describe, it, expect } from "vitest";
import { normalizeBirthdays } from "./birthdays";

describe("normalizeBirthdays", () => {
  it("handles null / empty inputs safely", () => {
    expect(normalizeBirthdays(null)).toEqual([]);
    expect(normalizeBirthdays(undefined)).toEqual([]);
    expect(normalizeBirthdays({})).toEqual([]);
    expect(normalizeBirthdays({ birthdays: [] })).toEqual([]);
  });

  it("accepts either {birthdays:[]} or a raw array", () => {
    const fromWrapper = normalizeBirthdays({ birthdays: [{ name: "Mom", date: "04-24" }] });
    const fromArray = normalizeBirthdays([{ name: "Mom", date: "04-24" }]);
    expect(fromWrapper).toEqual(fromArray);
  });

  it("assigns giftStatus=unknown when not supplied", () => {
    const r = normalizeBirthdays([{ name: "Mom", date: "04-24" }]);
    expect(r[0].giftStatus).toBe("unknown");
  });

  it("preserves explicit giftStatus", () => {
    const r = normalizeBirthdays([{ name: "Mom", date: "04-24", giftStatus: "ready" }]);
    expect(r[0].giftStatus).toBe("ready");
  });

  it("passes through MM-DD format as-is", () => {
    const r = normalizeBirthdays([{ name: "Mom", date: "04-24" }]);
    expect(r[0].date).toBe("04-24");
  });

  it("converts ISO date string to MM-DD", () => {
    const r = normalizeBirthdays([{ name: "Mom", date: "1980-04-24" }]);
    expect(r[0].date).toBe("04-24");
  });

  it("falls back to 01-01 on unparseable dates", () => {
    const r = normalizeBirthdays([{ name: "x", date: "garbage" }]);
    expect(r[0].date).toBe("01-01");
  });

  it("assigns a stable-ish id when missing", () => {
    const r = normalizeBirthdays([{ name: "Mom", date: "04-24" }]);
    expect(r[0].id).toContain("Mom");
  });
});
