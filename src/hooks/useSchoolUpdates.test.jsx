import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSchoolUpdates } from "./useSchoolUpdates";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useSchoolUpdates", () => {
  it("polls so voice-dismissed Needs Action school items leave the dashboard", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ updates: [{ id: "park-day-form", title: "Park day form" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ updates: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSchoolUpdates({ url: "http://worker", token: "t" }));
    await act(async () => {});

    expect(result.current.updates).toEqual([{ id: "park-day-form", title: "Park day form" }]);

    await act(async () => {
      vi.advanceTimersByTime(15 * 1000);
    });
    await act(async () => {});

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer t");
    expect(result.current.updates).toEqual([]);
  });
});
