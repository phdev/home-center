import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDesignSystem } from "./useDesignSystem";

describe("useDesignSystem", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.removeAttribute("data-design-system");
    window.history.pushState({}, "", "/");
    vi.restoreAllMocks();
  });

  it("defaults to version two and marks the body", () => {
    const { result } = renderHook(() => useDesignSystem(null));

    expect(result.current.designSystem).toBe("v2");
    expect(document.body.dataset.designSystem).toBe("v2");
  });

  it("accepts URL override for version one", () => {
    window.history.pushState({}, "", "/?designSystem=v1");

    const { result } = renderHook(() => useDesignSystem(null));

    expect(result.current.designSystem).toBe("v1");
    expect(document.body.dataset.designSystem).toBe("v1");
  });

  it("posts manual switches to the command server", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });

    const { result } = renderHook(() =>
      useDesignSystem({ url: "https://worker.test", token: "token" }, "v1"),
    );

    await act(async () => {
      await result.current.setDesignSystem("v2");
    });

    expect(result.current.designSystem).toBe("v2");
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8765/api/design-system",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"version":"v2"'),
        }),
      );
    });
  });
});
