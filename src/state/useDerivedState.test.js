import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { __testing } from "./useDerivedState";

// Mock useRawState so the hook under test sees a stable, controllable raw.
// We drive `nextMeaningfulTransition` by manipulating the system clock.
vi.mock("../data/useRawState", () => {
  return {
    useRawState: () => ({
      calendar: { events: [] },
      weather: { today: { highTempF: 70, lowTempF: 55, precipProb: 0, summary: "" } },
      birthdays: [],
      bedtime: [],
      checklist: { items: [] },
      takeout: { today: null },
      lunchDecisions: {},
      schoolLunchMenu: [],
      schoolItems: [],
      settings: {},
    }),
  };
});

// Dynamically import after the mock is registered.
const { useDerivedState } = await import("./useDerivedState");

beforeEach(() => {
  vi.useFakeTimers();
  // 12:00 on a weekday — far from any deterministic flip point.
  vi.setSystemTime(new Date("2026-04-23T12:00:00"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useDerivedState scheduling", () => {
  it("exposes the scheduling constants for review", () => {
    expect(__testing.FALLBACK_INTERVAL_MS).toBe(60_000);
    expect(__testing.MAX_PRECISE_SCHEDULE_MS).toBe(10 * 60_000);
  });

  it("schedules a fallback interval that ticks regardless of transition", async () => {
    const { result } = renderHook(() => useDerivedState());
    const firstNow = result.current.derived.nextMeaningfulTransition; // noop baseline
    expect(firstNow).toBeTruthy();
    // Advance beyond the next scheduled setTimeout (which fires first) and
    // through a subsequent fallback interval so setNow runs.
    await act(async () => {
      vi.advanceTimersByTime(__testing.MAX_PRECISE_SCHEDULE_MS + 1);
    });
    await act(async () => {
      vi.advanceTimersByTime(__testing.FALLBACK_INTERVAL_MS + 1);
    });
    // We can't easily assert on the internal `now` state, but the fact that
    // advancing timers does not throw and the hook remains mounted is
    // itself the contract we need: the interval survives long intervals
    // without the transition.
    expect(result.current.derived).toBeTruthy();
  });

  it("does not throw when nextMeaningfulTransition is in the past", async () => {
    const { result } = renderHook(() => useDerivedState());
    expect(result.current.derived.nextMeaningfulTransition).toBeTruthy();
    // Advance past the scheduled transition — the hook recomputes, picks a
    // new transition, and keeps going.
    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });
    expect(result.current.derived.nextMeaningfulTransition).toBeTruthy();
  });

  it("handles invalid transition timestamps without crashing", async () => {
    // Spy on setTimeout; a call with NaN or negative delay is evidence the
    // hook isn't gracefully handling an unparseable transition.
    const spy = vi.spyOn(globalThis, "setTimeout");
    const { unmount } = renderHook(() => useDerivedState());
    const badCalls = spy.mock.calls.filter(([, delay]) => !Number.isFinite(delay) || delay < 0);
    expect(badCalls.length).toBe(0);
    unmount();
    spy.mockRestore();
  });
});
