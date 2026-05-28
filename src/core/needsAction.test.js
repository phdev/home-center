import { describe, expect, it } from "vitest";
import { buildHowieActions } from "./needsAction";

function at(hour, minute = 0) {
  return new Date(2026, 4, 28, hour, minute, 0, 0);
}

describe("buildHowieActions", () => {
  it("uses suggestedAction as the school action detail when present", () => {
    const actions = buildHowieActions({
      rankedSchoolItems: [{
        id: "slip",
        kind: "action",
        title: "Permission slip",
        summary: "A field trip slip is due.",
        suggestedAction: "Sign and return the field trip slip.",
        urgency: 0.8,
      }],
    }, at(10));

    expect(actions[0]).toMatchObject({
      id: "school-slip",
      detail: "Sign and return the field trip slip.",
    });
  });

  it("returns every pending action sorted by urgency across categories", () => {
    const actions = buildHowieActions({
      rankedSchoolItems: [
        {
          id: "low-school",
          kind: "action",
          title: "Low school item",
          summary: "Later",
          urgency: 0.2,
        },
        {
          id: "urgent-school",
          kind: "action",
          title: "Urgent school item",
          summary: "Today",
          urgency: 0.9,
        },
      ],
      birthdayGiftNeeded: true,
      birthdaysRanked: [{ id: "mom", name: "Mom", daysUntil: 7, giftStatus: "needed" }],
      takeoutDecisionPending: true,
      takeoutState: { suggestedVendors: ["Rascals", "Mickey's"] },
      lunchDecisionNeeded: true,
      lunchContext: { menu: ["Pizza"] },
    }, at(16, 15));

    expect(actions.map((action) => action.id)).toEqual([
      "school-urgent-school",
      "takeout",
      "gift-mom",
      "lunch",
      "school-low-school",
    ]);
    expect(actions).toHaveLength(5);
    expect(actions[0]).not.toHaveProperty("urgencyScore");
    expect(actions[0]).not.toHaveProperty("tiebreaker");
  });

  it("breaks school urgency ties by soonest due date", () => {
    const actions = buildHowieActions({
      rankedSchoolItems: [
        {
          id: "later",
          kind: "action",
          title: "Later",
          summary: "Later",
          dueDate: "2026-05-30",
          urgency: 0.7,
        },
        {
          id: "sooner",
          kind: "action",
          title: "Sooner",
          summary: "Sooner",
          dueDate: "2026-05-29",
          urgency: 0.7,
        },
      ],
    }, at(10));

    expect(actions.map((action) => action.id)).toEqual(["school-sooner", "school-later"]);
  });

  it("returns the fallback when nothing is pending", () => {
    expect(buildHowieActions({}, at(10))).toEqual([{
      id: "fallback",
      kind: "Ready",
      tone: "neutral",
      meta: "Howie",
      title: "No urgent family actions",
      detail: "Howie will surface the next thing that needs attention.",
    }]);
  });
});
