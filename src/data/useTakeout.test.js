import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTakeoutWriter, useTakeout } from "./useTakeout";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("useTakeoutWriter — worker-first, local fallback", () => {
  it("persists to the worker when configured", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() =>
      useTakeoutWriter({ url: "http://worker", token: "t" }),
    );
    await act(async () => {
      await result.current({ decision: "takeout", vendor: "Mickey's Deli" });
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://worker/api/takeout/today");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer t");
  });

  it("falls back to localStorage when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));
    const { result } = renderHook(() =>
      useTakeoutWriter({ url: "http://worker" }),
    );
    await act(async () => {
      await result.current({ decision: "home" });
    });
    const stored = JSON.parse(window.localStorage.getItem("hc:takeout"));
    expect(stored.decision).toBe("home");
  });

  it("writes localStorage only when no worker URL is provided", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useTakeoutWriter());
    await act(async () => {
      await result.current({ decision: "takeout", vendor: "Chipotle" });
    });
    expect(fetchMock).not.toHaveBeenCalled();
    const stored = JSON.parse(window.localStorage.getItem("hc:takeout"));
    expect(stored.vendor).toBe("Chipotle");
  });
});

describe("useTakeout — read with fallback", () => {
  beforeEach(() => {
    // Seed localStorage with today's record so the fallback path is exercised.
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    window.localStorage.setItem(
      "hc:takeout",
      JSON.stringify({ date: key, decision: "takeout", vendor: "LocalFallback" }),
    );
  });

  it("returns localStorage value when worker is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    const { result } = renderHook(() =>
      useTakeout({ url: "http://worker" }),
    );
    // Initial render returns the local fallback synchronously.
    expect(result.current?.vendor).toBe("LocalFallback");
  });
});
