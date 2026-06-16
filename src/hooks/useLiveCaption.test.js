import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLiveCaption } from "./useLiveCaption";

describe("useLiveCaption", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-06-16T15:00:00Z").getTime());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows fresh active listening captions", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        text: "Hey Homer",
        is_wake: true,
        stage: "listening",
        ts: Date.now() / 1000,
      }),
    })));

    const { result } = renderHook(() => useLiveCaption({ url: "http://pi.test" }, { pollMs: 1000 }));

    await waitFor(() => {
      expect(result.current.stage).toBe("listening");
    });
    expect(result.current.text).toBe("");
    expect(result.current.isWake).toBe(true);
  });

  it("clears stale active stages so the speech bubble cannot hang forever", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        text: "Hey Homer",
        is_wake: true,
        stage: "listening",
        ts: Date.now() / 1000 - 20,
      }),
    })));

    const { result } = renderHook(() => useLiveCaption({ url: "http://pi.test" }, { pollMs: 1000 }));

    await waitFor(() => {
      expect(result.current.stage).toBe("");
    });
    expect(result.current.text).toBe("");
    expect(result.current.isWake).toBe(false);
    expect(result.current.age).toBe(Infinity);
  });
});
