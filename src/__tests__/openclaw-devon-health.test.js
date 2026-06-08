import { describe, expect, it, vi } from "vitest";
import {
  monitorDevonChannel,
  summarizeDevonChannelStatus,
} from "../../scripts/openclaw-devon-health.mjs";

function statusFor(account) {
  return {
    channelAccounts: {
      telegram: [
        {
          accountId: "default",
          enabled: true,
          configured: true,
          running: true,
          connected: true,
          restartPending: false,
          tokenStatus: "available",
        },
        {
          accountId: "devon",
          enabled: true,
          configured: true,
          running: true,
          connected: true,
          restartPending: false,
          tokenStatus: "available",
          ...account,
        },
      ],
    },
  };
}

describe("openclaw-devon-health", () => {
  it("accepts a running and connected Devon Telegram provider", () => {
    expect(summarizeDevonChannelStatus(statusFor({}))).toMatchObject({
      ok: true,
      restartRecommended: false,
      failures: [],
    });
  });

  it("detects the stuck provider state that made Devon unresponsive", () => {
    const summary = summarizeDevonChannelStatus(statusFor({
      running: false,
      connected: true,
      restartPending: true,
      healthState: "not-running",
    }));

    expect(summary.ok).toBe(false);
    expect(summary.restartRecommended).toBe(true);
    expect(summary.failures).toEqual([
      "account:telegram/devon:not-running",
      "account:telegram/devon:restart-pending",
      "account:telegram/devon:health-not-running",
    ]);
  });

  it("does not recommend a gateway restart for disabled Devon config", () => {
    const summary = summarizeDevonChannelStatus(statusFor({
      enabled: false,
      running: false,
      connected: false,
      restartPending: true,
    }));

    expect(summary.ok).toBe(false);
    expect(summary.restartRecommended).toBe(false);
    expect(summary.failures).toContain("account:telegram/devon:disabled");
  });

  it("does not recommend a gateway restart when Devon's token is unavailable", () => {
    const summary = summarizeDevonChannelStatus(statusFor({
      running: false,
      connected: false,
      restartPending: true,
      tokenStatus: "missing",
    }));

    expect(summary.ok).toBe(false);
    expect(summary.restartRecommended).toBe(false);
    expect(summary.failures).toContain("account:telegram/devon:token-missing");
  });

  it("retries before restarting so startup transients do not bounce the gateway", async () => {
    const readStatus = vi.fn()
      .mockResolvedValueOnce(statusFor({ connected: false }))
      .mockResolvedValueOnce(statusFor({ connected: true }));
    const restartGateway = vi.fn();

    const result = await monitorDevonChannel({
      readStatus,
      restartGateway,
      retryDelayMs: 0,
      postRestartDelayMs: 0,
      repair: true,
    });

    expect(result.ok).toBe(true);
    expect(result.recoveredAfterRetry).toBe(true);
    expect(result.repaired).toBe(false);
    expect(restartGateway).not.toHaveBeenCalled();
  });

  it("restarts the gateway when the stuck state persists after retry", async () => {
    const stuck = statusFor({
      running: false,
      connected: true,
      restartPending: true,
      healthState: "not-running",
    });
    const readStatus = vi.fn()
      .mockResolvedValueOnce(stuck)
      .mockResolvedValueOnce(stuck)
      .mockResolvedValueOnce(statusFor({}));
    const restartGateway = vi.fn().mockResolvedValue({ code: 0, stdout: "restarted", stderr: "" });

    const result = await monitorDevonChannel({
      readStatus,
      restartGateway,
      retryDelayMs: 0,
      postRestartDelayMs: 0,
      repair: true,
    });

    expect(result.ok).toBe(true);
    expect(result.repaired).toBe(true);
    expect(restartGateway).toHaveBeenCalledTimes(1);
    expect(readStatus).toHaveBeenCalledTimes(3);
  });
});
