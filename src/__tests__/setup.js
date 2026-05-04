// Global Vitest setup. Keep minimal — we prefer per-test mocks.
// jsdom ships localStorage already; just silence noisy React warnings if any.

import { beforeEach, afterEach, vi } from "vitest";

function createMemoryStorage() {
  let values = new Map();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.has(String(key)) ? values.get(String(key)) : null;
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key) {
      values.delete(String(key));
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    },
  };
}

if (
  typeof window !== "undefined" &&
  (!window.localStorage ||
    typeof window.localStorage.clear !== "function" ||
    typeof window.localStorage.getItem !== "function" ||
    typeof window.localStorage.setItem !== "function")
) {
  const storage = createMemoryStorage();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
}

beforeEach(() => {
  // Reset localStorage between tests so adapters start clean.
  try {
    window.localStorage.clear();
  } catch {}
});

afterEach(() => {
  vi.restoreAllMocks();
});
