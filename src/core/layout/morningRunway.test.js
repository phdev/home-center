import { describe, expect, it } from "vitest";
import {
  hasUrgentSchoolCard,
  isMorningRunwayMode,
  shouldSuppressStandalonePeterRisk,
} from "./morningRunway";

function at(h, m = 0) {
  return new Date(2026, 4, 5, h, m, 0, 0);
}

describe("morning runway layout rules", () => {
  it("activates only during the approved 7-9 morning window", () => {
    const derived = { showMorningChecklist: true };

    expect(isMorningRunwayMode(derived, at(6, 59))).toBe(false);
    expect(isMorningRunwayMode(derived, at(7, 0))).toBe(true);
    expect(isMorningRunwayMode(derived, at(8, 59))).toBe(true);
    expect(isMorningRunwayMode(derived, at(9, 0))).toBe(false);
    expect(isMorningRunwayMode({ showMorningChecklist: false }, at(7, 30))).toBe(false);
  });

  it("stays off outside the normal home dashboard view", () => {
    expect(
      isMorningRunwayMode({ showMorningChecklist: true }, at(7, 30), { isHomeView: false }),
    ).toBe(false);
  });

  it("suppresses a standalone Peter risk card only when runway can carry it", () => {
    expect(
      shouldSuppressStandalonePeterRisk({
        showMorningChecklist: true,
        peter0800_0900Risk: true,
        hasMorningOverlap: false,
      }),
    ).toBe(true);

    expect(
      shouldSuppressStandalonePeterRisk({
        showMorningChecklist: true,
        peter0800_0900Risk: true,
        hasMorningOverlap: true,
      }),
    ).toBe(false);
  });

  it("detects urgent school cards for morning primary promotion", () => {
    expect(hasUrgentSchoolCard([{ type: "SchoolUpdatesCard", priority: "urgent" }])).toBe(true);
    expect(hasUrgentSchoolCard([{ type: "SchoolUpdatesCard", priority: "important" }])).toBe(false);
  });
});
