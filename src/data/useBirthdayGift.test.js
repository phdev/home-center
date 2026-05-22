import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBirthdayGiftWriter, readGiftOverrides } from "./useBirthdayGift";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("useBirthdayGiftWriter", () => {
  it("sends PATCH with {giftStatus, giftNotes} to the per-id endpoint", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() =>
      useBirthdayGiftWriter({ url: "http://worker", token: "t" }),
    );
    await act(async () => {
      await result.current("bd-0-Mom", { giftStatus: "ordered" });
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://worker/api/birthdays/bd-0-Mom");
    expect(init.method).toBe("PATCH");
    expect(init.headers.Authorization).toBe("Bearer t");
    expect(JSON.parse(init.body)).toEqual({ giftStatus: "ordered", giftNotes: null });
  });

  it("URL-encodes ids that contain spaces or slashes", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useBirthdayGiftWriter({ url: "http://w" }));
    await act(async () => {
      await result.current("bd/1 Mom", { giftStatus: "needed" });
    });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("http://w/api/birthdays/bd%2F1%20Mom");
  });

  it("persists to localStorage when worker is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("down"))));
    const { result } = renderHook(() =>
      useBirthdayGiftWriter({ url: "http://worker" }),
    );
    await act(async () => {
      await result.current("bd-1", { giftStatus: "ready" });
    });
    expect(readGiftOverrides()["bd-1"].giftStatus).toBe("ready");
  });

  it("persists to localStorage when no worker URL is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useBirthdayGiftWriter());
    await act(async () => {
      await result.current("bd-2", { giftStatus: "needed", giftNotes: "books!" });
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(readGiftOverrides()["bd-2"].giftStatus).toBe("needed");
    expect(readGiftOverrides()["bd-2"].giftNotes).toBe("books!");
  });
});
