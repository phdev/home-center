import { describe, expect, it } from "vitest";
import {
  findPlaceholderMarkers,
  redactBrowserState,
  summarizeNodeHealth,
  validateLiveData,
} from "../../scripts/homecenter-node-health.mjs";

function healthy(overrides = {}) {
  return {
    dns: { ok: true, addresses: ["192.168.1.206"] },
    piApi: { ok: true, navigation: { page: "dashboard" } },
    ssh: { ok: true, hostname: "homecenter2", ips: ["192.168.1.206"] },
    services: {
      "dashboard-local": "active",
      "wake-word": "active",
      "kiosk-watchdog": "active",
      "network-watchdog": "active",
      "avahi-daemon": "active",
    },
    bundle: { ok: true, js: "assets/index-live.js", css: "assets/index-live.css" },
    liveData: {
      ok: true,
      counts: { calendar: 12, birthdays: 8, schoolUpdates: 2 },
      failures: [],
    },
    browser: {
      ok: true,
      url: "http://localhost:8080/home-center/",
      placeholderMarkers: [],
    },
    ...overrides,
  };
}

describe("homecenter-node-health", () => {
  it("accepts a fully live node", () => {
    expect(summarizeNodeHealth(healthy())).toEqual({ ok: true, failures: [] });
  });

  it("fails when the Pi disappears from DNS and the command API", () => {
    const summary = summarizeNodeHealth(healthy({
      dns: { ok: false, error: "ENOTFOUND" },
      piApi: { ok: false, error: "timeout" },
    }));

    expect(summary.ok).toBe(false);
    expect(summary.failures).toContain("dns:ENOTFOUND");
    expect(summary.failures).toContain("piApi:timeout");
  });

  it("fails when the kiosk watchdog is not running", () => {
    const summary = summarizeNodeHealth(healthy({
      services: {
        "dashboard-local": "active",
        "wake-word": "active",
        "kiosk-watchdog": "inactive",
        "network-watchdog": "active",
        "avahi-daemon": "active",
      },
    }));

    expect(summary.ok).toBe(false);
    expect(summary.failures).toContain("service:kiosk-watchdog:inactive");
  });

  it("fails when the network watchdog is not running", () => {
    const summary = summarizeNodeHealth(healthy({
      services: {
        "dashboard-local": "active",
        "wake-word": "active",
        "kiosk-watchdog": "active",
        "network-watchdog": "inactive",
        "avahi-daemon": "active",
      },
    }));

    expect(summary.ok).toBe(false);
    expect(summary.failures).toContain("service:network-watchdog:inactive");
  });

  it("fails when live data is empty or replaced by placeholders", () => {
    const summary = summarizeNodeHealth(healthy({
      liveData: {
        ok: false,
        counts: { calendar: 0, birthdays: 3, schoolUpdates: 2 },
        failures: ["liveData:calendar-empty", "liveData:birthdays-placeholder:3"],
      },
    }));

    expect(summary.ok).toBe(false);
    expect(summary.failures).toContain("liveData:calendar-empty");
    expect(summary.failures).toContain("liveData:birthdays-placeholder:3");
  });

  it("fails when Chromium renders known preview copy", () => {
    const summary = summarizeNodeHealth(healthy({
      browser: {
        ok: false,
        url: "http://localhost:8080/home-center/",
        placeholderMarkers: ["Family check-in"],
        error: "placeholder markers rendered: Family check-in",
      },
    }));

    expect(summary.ok).toBe(false);
    expect(summary.failures).toContain("browser:placeholder markers rendered: Family check-in");
  });

  it("redacts Worker token material and preserves placeholder evidence from browser state", () => {
    const redacted = redactBrowserState({
      url: "http://localhost:8080/home-center/",
      title: "Home Center",
      workerUrl: "https://home-center-api.phhowell.workers.dev",
      workerTokenPresent: false,
      workerToken: "secret",
      storageKeys: ["homeCenter_settings"],
      bodyText: `Next 7 Days\nFamily check-in\n${"x".repeat(500)}`,
    });

    expect(redacted).not.toHaveProperty("workerToken");
    expect(redacted.workerTokenPresent).toBe(false);
    expect(redacted.placeholderMarkers).toContain("Family check-in");
    expect(redacted.bodyPreview).toHaveLength(240);
  });

  it("detects known placeholder strings in rendered text", () => {
    expect(findPlaceholderMarkers("Today Family check-in and Cousin Lily")).toEqual([
      "Family check-in",
      "Cousin Lily",
    ]);
  });

  it("accepts non-empty live data without preview ids or names", () => {
    expect(validateLiveData({
      calendar: { events: [{ id: "cal-1", title: "Girl Scouts" }] },
      birthdays: { birthdays: [{ id: "bd-1", name: "Lindsey" }] },
      schoolUpdates: { updates: [] },
    })).toMatchObject({
      ok: true,
      counts: { calendar: 1, birthdays: 1, schoolUpdates: 0 },
    });
  });

  it("rejects preview constants even if their arrays are non-empty", () => {
    expect(validateLiveData({
      calendar: { events: [{ id: "preview-cal-standup", title: "Family check-in" }] },
      birthdays: { birthdays: [{ id: "preview-bd-grandma", name: "Grandma Sue" }] },
      schoolUpdates: { updates: [{ id: "preview-school-permission", title: "Field trip permission slip" }] },
    })).toMatchObject({
      ok: false,
      failures: [
        "liveData:calendar-placeholder:1",
        "liveData:birthdays-placeholder:1",
        "liveData:school-placeholder:1",
      ],
    });
  });
});
