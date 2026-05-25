import { describe, expect, it } from "vitest";
import { normalizeVisualPlan } from "./visualPlanUtils";

describe("normalizeVisualPlan", () => {
  it("preserves the Apollo/Penguin reference design contract for arbitrary event responses", () => {
    const plan = normalizeVisualPlan({
      type: "event",
      visualPlan: {
        visualFamily: "editorial-knowledge-v1",
        queryType: "event",
        moduleStyles: {
          hero: "archival-event-scene",
          facts: "compact-fact-rows",
          middle: "us-places-map",
          lower: "horizontal-mission-timeline",
        },
      },
    });

    expect(plan.designPrinciples).toMatchObject({
      version: "apollo-penguin-reference-v1",
      mapLabelPlacement: "external-callouts",
      timelineConnectorStyle: "segmented-between-icons",
      relatedChipScale: "compact-secondary-nav",
    });
    expect(plan.typeCompositionContract.middle).toContain("us-places-map");
    expect(plan.typeCompositionContract.lower).toContain("horizontal-mission-timeline");
  });
});
