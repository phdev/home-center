#!/usr/bin/env node
import { spawn } from "node:child_process";
import { lookup } from "node:dns/promises";
import http from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import process from "node:process";
import WebSocket from "ws";

const DEFAULT_NODES = [
  { name: "homecenter", host: "homecenter.local", expectedHostname: "homecenter" },
  { name: "homecenter2", host: "homecenter2.local", expectedHostname: "homecenter2" },
];

const REQUIRED_SYSTEMD = ["dashboard-local", "wake-word", "kiosk-watchdog", "network-watchdog", "avahi-daemon"];

export function summarizeNodeHealth(check) {
  const failures = [];
  if (!check.dns?.ok) failures.push(`dns:${check.dns?.error ?? "unresolved"}`);
  if (!check.piApi?.ok) failures.push(`piApi:${check.piApi?.error ?? "unreachable"}`);
  if (!check.ssh?.ok) failures.push(`ssh:${check.ssh?.error ?? "unreachable"}`);
  for (const service of REQUIRED_SYSTEMD) {
    const state = check.services?.[service];
    if (state !== "active") failures.push(`service:${service}:${state ?? "missing"}`);
  }
  if (!check.bundle?.ok) failures.push(`bundle:${check.bundle?.error ?? "unknown"}`);
  if (!check.browser?.ok) failures.push(`browser:${check.browser?.error ?? "unknown"}`);
  if (check.browser?.workerTokenPresent === false) failures.push("browser:worker-token-missing");
  return {
    ok: failures.length === 0,
    failures,
  };
}

export function redactBrowserState(value) {
  return {
    url: value?.url ?? null,
    title: value?.title ?? null,
    workerUrl: value?.workerUrl ?? null,
    workerTokenPresent: value?.workerTokenPresent === true,
    storageKeys: Array.isArray(value?.storageKeys) ? value.storageKeys : [],
    bodyPreview: typeof value?.bodyText === "string" ? value.bodyText.slice(0, 240) : "",
  };
}

function parseNodes() {
  const raw = process.env.HOME_CENTER_NODE_HOSTS;
  if (!raw) return DEFAULT_NODES;
  return raw.split(",").map((entry) => {
    const [name, host, expectedHostname = name] = entry.split(":");
    return { name, host, expectedHostname };
  });
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), options.timeoutMs ?? 8000);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

function fetchJson(url, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      let body = "";
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        if ((response.statusCode ?? 500) >= 400) {
          reject(new Error(`http ${response.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.on("error", reject);
  });
}

async function checkDns(host) {
  try {
    const addresses = await lookup(host, { all: true });
    return { ok: addresses.length > 0, addresses: addresses.map((item) => item.address) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function checkPiApi(host) {
  try {
    const payload = await fetchJson(`http://${host}:8765/api/navigate`);
    if (!payload?.navigation) return { ok: false, error: "missing navigation" };
    return { ok: true, navigation: payload.navigation };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function parseSshHealth(stdout, expectedHostname) {
  const lines = stdout.trim().split(/\n/);
  const hostname = lines.shift() ?? "";
  const ipLine = lines.shift() ?? "";
  const services = {};
  for (const line of lines) {
    const [name, state] = line.split("=");
    if (name && state) services[name] = state;
  }
  return {
    ok: hostname === expectedHostname,
    hostname,
    ips: ipLine.split(/\s+/).filter(Boolean),
    services,
    error: hostname === expectedHostname ? null : `expected hostname ${expectedHostname}, got ${hostname || "empty"}`,
  };
}

async function checkSsh(node) {
  const remote = [
    "hostname",
    "hostname -I",
    ...REQUIRED_SYSTEMD.map((service) => `printf '${service}='; systemctl is-active ${service} 2>/dev/null || true`),
  ].join("; ");
  const result = await run("ssh", ["-o", "ConnectTimeout=5", node.host, remote], { timeoutMs: 10000 });
  if (result.code !== 0) {
    return { ok: false, error: (result.stderr || result.stdout).trim() || `ssh exited ${result.code}` };
  }
  return parseSshHealth(result.stdout, node.expectedHostname);
}

async function checkBundle(host) {
  const remote = `python3 - <<'PY'
from pathlib import Path
import re
text = Path('/home/pi/home-center/dashboard-local/home-center/index.html').read_text()
js = re.search(r'assets/index-[^" ]+\\.js', text)
css = re.search(r'assets/index-[^" ]+\\.css', text)
print((js.group(0) if js else '') + ' ' + (css.group(0) if css else ''))
PY`;
  const result = await run("ssh", ["-o", "ConnectTimeout=5", host, remote], { timeoutMs: 10000 });
  if (result.code !== 0) return { ok: false, error: (result.stderr || result.stdout).trim() };
  const [js, css] = result.stdout.trim().split(/\s+/);
  return { ok: Boolean(js && css), js, css, error: js && css ? null : "missing built assets" };
}

function localPortFor(index) {
  return 12440 + index;
}

async function evaluateBrowserState(host, index) {
  const port = localPortFor(index);
  const ssh = spawn("ssh", [
    "-N",
    "-o", "ExitOnForwardFailure=yes",
    "-o", "ConnectTimeout=5",
    "-L", `127.0.0.1:${port}:127.0.0.1:9222`,
    host,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  ssh.stderr.on("data", (chunk) => { stderr += chunk; });
  try {
    await waitForTunnel(port, ssh, () => stderr);
    const pages = await fetchJson(`http://127.0.0.1:${port}/json/list`);
    const page = pages.find((item) => item.type === "page");
    if (!page?.webSocketDebuggerUrl) throw new Error("no browser page");
    const wsUrl = page.webSocketDebuggerUrl.replace("127.0.0.1:9222", `127.0.0.1:${port}`);
    const value = await cdpEvaluate(wsUrl, `(() => {
      const raw = localStorage.getItem('homeCenter_settings');
      let settings = null;
      try { settings = raw ? JSON.parse(raw) : null; } catch {}
      return {
        url: location.href,
        title: document.title,
        workerUrl: settings?.worker?.url || null,
        workerTokenPresent: Boolean(settings?.worker?.token),
        storageKeys: Object.keys(localStorage).sort(),
        bodyText: document.body.innerText || ''
      };
    })()`);
    const redacted = redactBrowserState(value);
    return {
      ok: page.url?.includes("/home-center/") && redacted.workerTokenPresent,
      ...redacted,
      error: redacted.workerTokenPresent ? null : "worker token missing",
    };
  } catch (error) {
    return { ok: false, error: error.message };
  } finally {
    ssh.kill("SIGTERM");
  }
}

async function waitForTunnel(port, child, stderr, timeoutMs = 3000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode != null) throw new Error(stderr().trim() || `ssh tunnel exited ${child.exitCode}`);
    try {
      await fetchJson(`http://127.0.0.1:${port}/json/version`, 500);
      return;
    } catch {
      await delay(150);
    }
  }
  throw new Error("cdp tunnel did not open");
}

function cdpEvaluate(wsUrl, expression) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("cdp timeout"));
    }, 5000);
    ws.on("open", () => {
      ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
    });
    ws.on("message", (message) => {
      const response = JSON.parse(String(message));
      if (response.id !== 1) return;
      clearTimeout(timer);
      ws.close();
      if (response.error) reject(new Error(response.error.message));
      else resolve(response.result.result.value);
    });
    ws.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

export async function checkNode(node, index = 0) {
  const [dns, piApi, ssh, bundle, browser] = await Promise.all([
    checkDns(node.host),
    checkPiApi(node.host),
    checkSsh(node),
    checkBundle(node.host),
    evaluateBrowserState(node.host, index),
  ]);
  const check = {
    name: node.name,
    host: node.host,
    checkedAt: new Date().toISOString(),
    dns,
    piApi,
    ssh: { ok: ssh.ok, hostname: ssh.hostname, ips: ssh.ips, error: ssh.error },
    services: ssh.services ?? {},
    bundle,
    browser,
  };
  return { ...check, ...summarizeNodeHealth(check) };
}

async function main() {
  const nodes = parseNodes();
  const checks = [];
  for (let i = 0; i < nodes.length; i++) {
    checks.push(await checkNode(nodes[i], i));
  }
  const result = {
    ok: checks.every((check) => check.ok),
    checkedAt: new Date().toISOString(),
    checks,
  };
  console.log(JSON.stringify(result, null, 2));
  return result.ok ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => process.exit(code)).catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exit(1);
  });
}
