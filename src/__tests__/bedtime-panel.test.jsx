import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BedtimePanel } from "../App";

afterEach(() => cleanup());

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

  it("opens a wake-up time picker and saves the selected time", async () => {
    const onLogWakeTime = vi.fn().mockResolvedValue({});
    render(
      <BedtimePanel
        onLogWakeTime={onLogWakeTime}
        derived={{
          wakeLogNeeded: true,
          wakeLogStatus: {
            missing: [{ childId: "lucy", childName: "Lucy" }],
          },
          wakeDerivedBedtimes: [
            {
              childId: "lucy",
              childName: "Lucy",
              wakeAt: null,
              bedtimeAt: "2026-06-06T20:00:00-07:00",
              source: "schedule",
            },
          ],
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Log Lucy wake-up time" }));
    const picker = screen.getByLabelText("Lucy wake-up time");
    fireEvent.change(picker, { target: { value: "07:20" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onLogWakeTime).toHaveBeenCalledWith({
        childId: "lucy",
        childName: "Lucy",
        time: "07:20",
      });
    });
  });
});
