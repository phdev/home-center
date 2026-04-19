import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { enhance } from "./openclaw";

describe("enhance() — graceful fallback contract", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns {source:'fallback'} when workerSettings.url is missing", async () => {
    const r = await enhance({ feature: "x", state: {} }, undefined);
    expect(r.source).toBe("fallback");
    expect(r.fields).toEqual({});
    expect(r.error).toBe("no-worker-url");
  });

  it("returns fallback when fetch rejects (network error)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("ECONNREFUSED"))));
    const r = await enhance(
      { feature: "morningChecklist", state: { items: [] } },
      { url: "http://worker.local" },
    );
    expect(r.source).toBe("fallback");
    expect(r.fields).toEqual({});
    expect(r.error).toBeTruthy();
  });

  it("returns fallback on non-2xx responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }),
      ),
    );
    const r = await enhance(
      { feature: "bedtime", state: { bedtimeAt: "", minutesUntil: 30 } },
      { url: "http://worker.local" },
    );
    expect(r.source).toBe("fallback");
    expect(r.error).toBe("http-500");
  });

  it("returns parsed fields on 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ fields: { intro: "hey" } }),
        }),
      ),
    );
    const r = await enhance(
      { feature: "morningChecklist", state: { items: [] } },
      { url: "http://worker.local" },
    );
    expect(r.source).toBe("openclaw");
    expect(r.fields.intro).toBe("hey");
  });

  it("aborts on timeout and returns fallback{error:'timeout'}", async () => {
    // Mock fetch to honor AbortSignal.
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, init) => {
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      }),
    );
    const start = Date.now();
    const r = await enhance(
      { feature: "x", state: {}, opts: { timeoutMs: 50 } },
      { url: "http://worker.local" },
    );
    expect(r.source).toBe("fallback");
    expect(r.error).toBe("timeout");
    expect(Date.now() - start).toBeLessThan(500);
  });

  it("passes through the worker token as Authorization bearer when present", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ fields: {} }),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await enhance(
      { feature: "x", state: {} },
      { url: "http://worker.local", token: "t0ken" },
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer t0ken");
  });

  it("never throws — even on malformed JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.reject(new SyntaxError("Unexpected token")),
        }),
      ),
    );
    const r = await enhance(
      { feature: "x", state: {} },
      { url: "http://worker.local" },
    );
    expect(r.source).toBe("fallback");
  });
});
