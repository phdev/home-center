import { describe, it, expect, vi, afterEach } from "vitest";
import { readWithFallback, writeWithFallback } from "./_storage";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readWithFallback", () => {
  it("returns localStorage value when workerSettings.url is missing", async () => {
    const readLocal = vi.fn(() => ({ local: true }));
    const writeLocal = vi.fn();
    const r = await readWithFallback({
      workerSettings: undefined,
      path: "/api/x",
      readLocal,
      writeLocal,
    });
    expect(r).toEqual({ local: true });
    expect(readLocal).toHaveBeenCalled();
    expect(writeLocal).not.toHaveBeenCalled();
  });

  it("prefers worker response and mirrors it to local storage", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ from: "worker" }) }),
    ));
    const writeLocal = vi.fn();
    const r = await readWithFallback({
      workerSettings: { url: "http://worker" },
      path: "/api/x",
      readLocal: () => ({ from: "local" }),
      writeLocal,
    });
    expect(r).toEqual({ from: "worker" });
    expect(writeLocal).toHaveBeenCalledWith({ from: "worker" });
  });

  it("falls back to local when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    const r = await readWithFallback({
      workerSettings: { url: "http://worker" },
      path: "/api/x",
      readLocal: () => ({ from: "local" }),
      writeLocal: vi.fn(),
    });
    expect(r).toEqual({ from: "local" });
  });

  it("falls back to local on non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }),
    ));
    const r = await readWithFallback({
      workerSettings: { url: "http://worker" },
      path: "/api/x",
      readLocal: () => ({ from: "local" }),
      writeLocal: vi.fn(),
    });
    expect(r).toEqual({ from: "local" });
  });

  it("falls back when parse() rejects the shape", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ wrong: true }) }),
    ));
    const r = await readWithFallback({
      workerSettings: { url: "http://worker" },
      path: "/api/x",
      readLocal: () => ({ from: "local" }),
      writeLocal: vi.fn(),
      parse: () => null,
    });
    expect(r).toEqual({ from: "local" });
  });

  it("attaches Bearer token when provided", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await readWithFallback({
      workerSettings: { url: "http://worker", token: "abc" },
      path: "/api/x",
      readLocal: () => null,
      writeLocal: vi.fn(),
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer abc");
  });
});

describe("writeWithFallback", () => {
  it("writes to local only when no worker configured", async () => {
    const onFail = vi.fn();
    const r = await writeWithFallback({
      workerSettings: undefined,
      path: "/api/x",
      body: { a: 1 },
      writeLocalOnFailure: onFail,
    });
    expect(r.source).toBe("local");
    expect(onFail).toHaveBeenCalled();
  });

  it("writes to worker + local on success", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) }),
    ));
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    const r = await writeWithFallback({
      workerSettings: { url: "http://worker" },
      path: "/api/x",
      body: { a: 1 },
      writeLocalOnFailure: onFailure,
      writeLocalOnSuccess: onSuccess,
    });
    expect(r.source).toBe("both");
    expect(onSuccess).toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("falls back to local when worker rejects", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    const onFailure = vi.fn();
    const r = await writeWithFallback({
      workerSettings: { url: "http://worker" },
      path: "/api/x",
      body: { a: 1 },
      writeLocalOnFailure: onFailure,
    });
    expect(r.source).toBe("local");
    expect(onFailure).toHaveBeenCalled();
  });

  it("falls back on non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }),
    ));
    const onFailure = vi.fn();
    const r = await writeWithFallback({
      workerSettings: { url: "http://worker" },
      path: "/api/x",
      body: {},
      writeLocalOnFailure: onFailure,
    });
    expect(r.source).toBe("local");
    expect(onFailure).toHaveBeenCalled();
  });

  it("sends JSON body + content-type + Bearer", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await writeWithFallback({
      workerSettings: { url: "http://worker", token: "t" },
      path: "/api/x",
      method: "PATCH",
      body: { a: 1 },
      writeLocalOnFailure: vi.fn(),
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("PATCH");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.headers.Authorization).toBe("Bearer t");
    expect(JSON.parse(init.body)).toEqual({ a: 1 });
  });
});
