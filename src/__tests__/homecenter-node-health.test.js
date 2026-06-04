import { describe, expect, it } from "vitest";
import { redactBrowserState, summarizeNodeHealth } from "../../scripts/homecenter-node-health.mjs";

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
    browser: {
      ok: true,
      url: "http://localhost:8080/home-center/",
      workerTokenPresent: true,
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

  it("fails when Chromium has no Worker token and would fall back to local data", () => {
    const summary = summarizeNodeHealth(healthy({
      browser: {
        ok: false,
        url: "http://localhost:8080/home-center/",
        workerTokenPresent: false,
        error: "worker token missing",
      },
    }));

    expect(summary.ok).toBe(false);
    expect(summary.failures).toContain("browser:worker token missing");
    expect(summary.failures).toContain("browser:worker-token-missing");
  });

  it("redacts Worker token material from browser state", () => {
    const redacted = redactBrowserState({
      url: "http://localhost:8080/home-center/",
      title: "Home Center",
      workerUrl: "https://home-center-api.phhowell.workers.dev",
      workerTokenPresent: true,
      workerToken: "secret",
      storageKeys: ["homeCenter_settings"],
      bodyText: "x".repeat(500),
    });

    expect(redacted).not.toHaveProperty("workerToken");
    expect(redacted.workerTokenPresent).toBe(true);
    expect(redacted.bodyPreview).toHaveLength(240);
  });
});
