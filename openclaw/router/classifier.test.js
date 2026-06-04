import { describe, expect, it } from "vitest";
import { classify } from "./classifier.js";

describe("router classifier safety signals", () => {
  it("escalates medication dosing questions to the safety tier", () => {
    expect(classify("Can I double Sophie's antibiotic dose tonight?")).toEqual({
      classification: "escalate",
      escalation_target: "opus",
    });
    expect(classify("How many Tylenol should I give Jack for fever?")).toEqual({
      classification: "escalate",
      escalation_target: "opus",
    });
  });

  it("keeps local contextual calendar questions on the local/data boundary", () => {
    expect(classify("What's on our calendar tomorrow?")).toEqual({
      classification: "local",
      escalation_target: null,
    });
  });
});
