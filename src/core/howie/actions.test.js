import { describe, expect, it } from "vitest";
import { buildHowieActions } from "./actions";

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
        suggestedAction: "Sign the waiver tonight",
        dueDate: "2026-05-29",
        urgency: 0.8,
      }],
    }, at(10));

    expect(actions[0]).toMatchObject({
      id: "school-slip",
      tone: "urgent",
      meta: "Due May 29",
      detailLabel: "Suggested action",
      detail: "Sign the waiver tonight",
    });
  });

  it("colors Needs Action items red within two days and yellow within five days", () => {
    const actions = buildHowieActions({
      rankedSchoolItems: [
        {
          id: "red",
          kind: "action",
          title: "Due soon",
          summary: "Due soon",
          dueDate: "2026-05-30",
          urgency: 0.2,
        },
        {
          id: "yellow",
          kind: "action",
          title: "Due this week",
          summary: "Due this week",
          dueDate: "2026-06-02",
          urgency: 0.2,
        },
        {
          id: "neutral",
          kind: "action",
          title: "Due later",
          summary: "Due later",
          dueDate: "2026-06-03",
          urgency: 0.2,
        },
      ],
    }, at(10));

    expect(actions.find((action) => action.id === "school-red")).toMatchObject({ tone: "urgent" });
    expect(actions.find((action) => action.id === "school-yellow")).toMatchObject({ tone: "warning" });
    expect(actions.find((action) => action.id === "school-neutral")).toMatchObject({ tone: "neutral" });
  });

  it("interleaves takeout, gift, and school by urgency at dinner cutoff", () => {
    const derived = {
      rankedSchoolItems: [{
        id: "school",
        kind: "action",
        title: "School form",
        summary: "Later",
        urgency: 0.3,
      }],
      birthdayGiftNeeded: true,
      birthdaysRanked: [{ id: "mom", name: "Mom", daysUntil: 2, giftStatus: "needed" }],
      takeoutDecisionPending: true,
      takeoutState: { suggestedVendors: ["Rascals"] },
    };

    expect(buildHowieActions(derived, at(17)).map((action) => action.id)).toEqual([
      "takeout",
      "gift-mom",
      "school-school",
    ]);
    expect(buildHowieActions(derived, at(10)).map((action) => action.id)).toEqual([
      "gift-mom",
      "school-school",
      "takeout",
    ]);
  });

  it("adds a suggested action for birthday gifts", () => {
    const actions = buildHowieActions({
      birthdayGiftNeeded: true,
      birthdaysRanked: [{ id: "kate", name: "Kate", date: "05-29", daysUntil: 1, giftStatus: "needed" }],
    }, at(10));

    expect(actions[0]).toMatchObject({
      id: "gift-kate",
      meta: "Birthday May 29",
      title: "Order Kate's gift",
      detailLabel: "Suggested action",
      detail: "Order birthday present",
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
      meta: "Homer",
      title: "No urgent family actions",
      detail: "Homer will surface the next thing that needs attention.",
    }]);
  });
});
