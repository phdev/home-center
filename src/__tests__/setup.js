// Global Vitest setup. Keep minimal — we prefer per-test mocks.
// jsdom ships localStorage already; just silence noisy React warnings if any.

import { beforeEach, afterEach, vi } from "vitest";

beforeEach(() => {
  // Reset localStorage between tests so adapters start clean.
  try {
    window.localStorage.clear();
  } catch {}
});

afterEach(() => {
  vi.restoreAllMocks();
});
