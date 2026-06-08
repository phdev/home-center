#!/usr/bin/env node
import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const DEFAULT_CHANNEL = "telegram";
const DEFAULT_ACCOUNT_ID = "devon";
const DEFAULT_STATUS_TIMEOUT_MS = 15000;
const DEFAULT_RESTART_TIMEOUT_MS = 30000;
const DEFAULT_RETRY_DELAY_MS = 15000;
const DEFAULT_POST_RESTART_DELAY_MS = 25000;
const DEFAULT_PATH = "/opt/homebrew/bin:/opt/homebrew/opt/node/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";

export function summarizeDevonChannelStatus(status, options = {}) {
  const channel = options.channel ?? DEFAULT_CHANNEL;
  const accountId = options.accountId ?? DEFAULT_ACCOUNT_ID;
  const failures = [];
  let restartRecommended = false;

  const accounts = status?.channelAccounts?.[channel];
  if (!Array.isArray(accounts)) {
    return {
      ok: false,
      restartRecommended: true,
      channel,
      accountId,
      failures: [`channel:${channel}:missing-accounts`],
      account: null,
    };
  }

  const account = accounts.find((candidate) => candidate?.accountId === accountId) ?? null;
  if (!account) {
    return {
      ok: false,
      restartRecommended: false,
      channel,
      accountId,
      failures: [`account:${channel}/${accountId}:missing`],
      account: null,
    };
  }

  if (account.enabled === false) {
    failures.push(`account:${channel}/${accountId}:disabled`);
  }
  if (account.configured === false) {
    failures.push(`account:${channel}/${accountId}:not-configured`);
  }
  const tokenAvailable = !account.tokenStatus || account.tokenStatus === "available";
  if (!tokenAvailable) {
    failures.push(`account:${channel}/${accountId}:token-${account.tokenStatus}`);
  }
  if (account.running !== true) {
    failures.push(`account:${channel}/${accountId}:not-running`);
    restartRecommended = true;
  }
  if (account.restartPending === true) {
    failures.push(`account:${channel}/${accountId}:restart-pending`);
    restartRecommended = true;
  }
  if (account.connected !== true) {
    failures.push(`account:${channel}/${accountId}:not-connected`);
    restartRecommended = true;
  }
  if (account.healthState && !["ok", "healthy", "running"].includes(account.healthState)) {
    failures.push(`account:${channel}/${accountId}:health-${account.healthState}`);
    restartRecommended = true;
  }
  if (account.lastError) {
    failures.push(`account:${channel}/${accountId}:last-error:${String(account.lastError).slice(0, 160)}`);
    restartRecommended = true;
  }

  return {
    ok: failures.length === 0,
    restartRecommended:
      restartRecommended &&
      account.enabled !== false &&
      account.configured !== false &&
      tokenAvailable,
    channel,
    accountId,
    failures,
    account: {
      enabled: account.enabled,
      configured: account.configured,
      running: account.running,
      connected: account.connected,
      restartPending: account.restartPending,
      healthState: account.healthState ?? null,
      tokenStatus: account.tokenStatus ?? null,
      lastStartAt: account.lastStartAt ?? null,
      lastStopAt: account.lastStopAt ?? null,
      lastConnectedAt: account.lastConnectedAt ?? null,
      lastInboundAt: account.lastInboundAt ?? null,
      lastOutboundAt: account.lastOutboundAt ?? null,
      lastError: account.lastError ?? null,
    },
  };
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PATH: process.env.PATH ? `${DEFAULT_PATH}:${process.env.PATH}` : DEFAULT_PATH,
        ...(options.env ?? {}),
      },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), options.timeoutMs ?? DEFAULT_STATUS_TIMEOUT_MS);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: 127, stdout, stderr: error.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

async function openclawJson(args, timeoutMs = DEFAULT_STATUS_TIMEOUT_MS) {
  const binary = process.env.OPENCLAW_BIN || "openclaw";
  const result = await run(binary, args, { timeoutMs });
  if (result.code !== 0) {
    throw new Error((result.stderr || result.stdout).trim() || `openclaw exited ${result.code}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`openclaw returned invalid JSON: ${error.message}`);
  }
}

export async function readDevonChannelHealth(options = {}) {
  try {
    const status = await (options.readStatus ?? (() => openclawJson(["channels", "status", "--json"])))();
    return {
      ok: true,
      checkedAt: new Date().toISOString(),
      status: summarizeDevonChannelStatus(status, options),
    };
  } catch (error) {
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      status: {
        ok: false,
        restartRecommended: true,
        channel: options.channel ?? DEFAULT_CHANNEL,
        accountId: options.accountId ?? DEFAULT_ACCOUNT_ID,
        failures: [`openclaw-status:${error.message}`],
        account: null,
      },
    };
  }
}

export async function monitorDevonChannel(options = {}) {
  const repair = options.repair === true;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const postRestartDelayMs = options.postRestartDelayMs ?? DEFAULT_POST_RESTART_DELAY_MS;
  const restartGateway = options.restartGateway ?? (() => run(
    process.env.OPENCLAW_BIN || "openclaw",
    ["gateway", "restart"],
    { timeoutMs: DEFAULT_RESTART_TIMEOUT_MS },
  ));

  const first = await readDevonChannelHealth(options);
  if (first.status.ok) return { ok: true, checkedAt: first.checkedAt, attempts: [first], repaired: false };

  if (retryDelayMs > 0) await delay(retryDelayMs);
  const second = await readDevonChannelHealth(options);
  if (second.status.ok) {
    return { ok: true, checkedAt: second.checkedAt, attempts: [first, second], recoveredAfterRetry: true, repaired: false };
  }

  if (!repair || !second.status.restartRecommended) {
    return { ok: false, checkedAt: second.checkedAt, attempts: [first, second], repaired: false };
  }

  const restart = await restartGateway();
  if (restart.code !== 0) {
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      attempts: [first, second],
      repaired: false,
      restart: {
        ok: false,
        code: restart.code,
        stderr: String(restart.stderr || "").slice(-4000),
        stdout: String(restart.stdout || "").slice(-4000),
      },
    };
  }

  if (postRestartDelayMs > 0) await delay(postRestartDelayMs);
  const afterRestart = await readDevonChannelHealth(options);
  return {
    ok: afterRestart.status.ok,
    checkedAt: afterRestart.checkedAt,
    attempts: [first, second, afterRestart],
    repaired: afterRestart.status.ok,
    restart: {
      ok: true,
      code: restart.code,
      stdout: String(restart.stdout || "").slice(-4000),
      stderr: String(restart.stderr || "").slice(-4000),
    },
  };
}

function parseCliArgs(argv) {
  return {
    repair: argv.includes("--repair"),
    json: argv.includes("--json") || !argv.includes("--plain"),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseCliArgs(process.argv.slice(2));
  monitorDevonChannel({ repair: args.repair }).then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  }).catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exit(1);
  });
}
