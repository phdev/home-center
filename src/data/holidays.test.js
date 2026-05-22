import { describe, it, expect } from "vitest";
import { getUpcomingHolidays } from "./holidays";

describe("getUpcomingHolidays", () => {
  it("returns holidays within the next 60 days from a given date, sorted ascending", () => {
    const now = new Date(2026, 3, 24); // Apr 24, 2026
    const result = getUpcomingHolidays(now, { daysAhead: 60, max: 10 });

    expect(result.length).toBeGreaterThan(0);
    // First two should be Cinco de Mayo (May 5) and Mother's Day (May 10)
    expect(result[0].name).toBe("Cinco de Mayo");
    expect(result[1].name).toBe("Mother's Day");
    // All should be within 60 days
    for (const h of result) {
      expect(h.daysUntil).toBeGreaterThanOrEqual(0);
      expect(h.daysUntil).toBeLessThanOrEqual(60);
    }
  });

  it("respects the max cap", () => {
    const now = new Date(2026, 3, 1);
    expect(getUpcomingHolidays(now, { daysAhead: 365, max: 3 })).toHaveLength(3);
  });

  it("returns daysUntil=0 when called on the same day as a holiday", () => {
    const cinco = new Date(2026, 4, 5); // May 5, 2026
    const [first] = getUpcomingHolidays(cinco, { daysAhead: 1, max: 1 });
    expect(first.name).toBe("Cinco de Mayo");
    expect(first.daysUntil).toBe(0);
  });
});
