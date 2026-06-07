import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BedtimePanel } from "../App";

describe("BedtimePanel", () => {
  it("calls for wake-up logging when wake times are missing", () => {
    render(
      <BedtimePanel
        derived={{
          wakeLogNeeded: true,
          wakeLogStatus: {
            missing: [
              { childId: "lucy", childName: "Lucy" },
              { childId: "livy", childName: "Livy" },
            ],
          },
          wakeDerivedBedtimes: [
            {
              childId: "lucy",
              childName: "Lucy",
              wakeAt: null,
              bedtimeAt: "2026-06-06T20:00:00-07:00",
              source: "schedule",
            },
            {
              childId: "livy",
              childName: "Livy",
              wakeAt: null,
              bedtimeAt: "2026-06-06T20:00:00-07:00",
              source: "schedule",
            },
          ],
        }}
      />
    );

    expect(screen.getByText("Bedtime")).toBeTruthy();
    expect(screen.getByText("Lucy")).toBeTruthy();
    expect(screen.getByText("Livy")).toBeTruthy();
    expect(screen.getAllByText("Pending wake-up time")).toHaveLength(2);
    expect(screen.getByText('Say "Hey Homer, both girls woke up at 7:00."')).toBeTruthy();
  });

  it("shows wake-derived bedtime copy when wake times are logged", () => {
    render(
      <BedtimePanel
        derived={{
          wakeLogNeeded: false,
          wakeLogStatus: { missing: [] },
          wakeDerivedBedtimes: [
            {
              childId: "lucy",
              childName: "Lucy",
              wakeAt: "2026-06-06T07:15:00-07:00",
              bedtimeAt: "2026-06-06T20:45:00-07:00",
              source: "wake-log",
            },
          ],
        }}
      />
    );

    expect(screen.getByText("Based on 7:15 AM wake-up")).toBeTruthy();
    expect(screen.getByText("8:45 PM")).toBeTruthy();
    expect(screen.getByText("Wake logged")).toBeTruthy();
  });
});
