#!/usr/bin/env node
import { spawn } from "node:child_process";
import { lookup } from "node:dns/promises";
import http from "node:http";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import process from "node:process";
import WebSocket from "ws";

const DEFAULT_NODES = [
  { name: "homecenter", host: "homecenter.local", expectedHostname: "homecenter" },
  { name: "homecenter2", host: "homecenter2.local", expectedHostname: "homecenter2" },
];

const REQUIRED_SYSTEMD = ["dashboard-local", "wake-word", "kiosk-watchdog", "network-watchdog", "avahi-daemon"];
const PLACEHOLDER_MARKERS = [
  "Family check-in",
  "Soccer practice",
  "Dinner with Grandma Sue",
  "Pack field trip lunch",
  "Piano lesson",
  "Scout meeting",
  "School assembly",
  "Library pickup",
  "Pizza night",
  "Park meetup",
  "Grandma Sue",
  "Uncle Mike",
  "Cousin Lily",
  "Field trip permission slip",
  "Book fair volunteer window",
];
const PLACEHOLDER_CALENDAR_TITLES = new Set([
  "family check-in",
  "soccer practice",
  "dinner with grandma sue",
  "pack field trip lunch",
  "piano lesson",
  "scout meeting",
  "school assembly",
  "dinner prep",
  "library pickup",
  "pizza night",
  "park meetup",
  "plan the week",
]);
const PLACEHOLDER_BIRTHDAY_NAMES = new Set(["grandma sue", "uncle mike", "cousin lily"]);
const PLACEHOLDER_SCHOOL_TITLES = new Set(["field trip permission slip", "book fair volunteer window"]);

export function summarizeNodeHealth(check) {
  const failures = [];
  if (!check.dns?.ok) failures.push(`dns:${check.dns?.error ?? "unresolved"}`);
  if (!check.piApi?.ok) failures.push(`piApi:${check.piApi?.error ?? "unreachable"}`);
  if (!check.voiceCommands?.ok) failures.push(...(check.voiceCommands?.failures ?? ["voiceCommands:unknown"]));
  if (!check.ssh?.ok) failures.push(`ssh:${check.ssh?.error ?? "unreachable"}`);
  for (const service of REQUIRED_SYSTEMD) {
    const state = check.services?.[service];
    if (state !== "active") failures.push(`service:${service}:${state ?? "missing"}`);
  }
  if (!check.bundle?.ok) failures.push(`bundle:${check.bundle?.error ?? "unknown"}`);
  if (!check.liveData?.ok) failures.push(...(check.liveData?.failures ?? ["liveData:unknown"]));
  if (!check.browser?.ok) failures.push(`browser:${check.browser?.error ?? "unknown"}`);
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
    placeholderMarkers: findPlaceholderMarkers(value?.bodyText ?? ""),
    bodyPreview: typeof value?.bodyText === "string" ? value.bodyText.slice(0, 240) : "",
  };
}

export function findPlaceholderMarkers(text) {
  if (typeof text !== "string" || !text) return [];
  const lower = text.toLowerCase();
  return PLACEHOLDER_MARKERS.filter((marker) => lower.includes(marker.toLowerCase()));
}

export function validateLiveData(data) {
  const failures = [];
  const events = data?.calendar?.events;
  const birthdays = data?.birthdays?.birthdays;
  const schoolUpdates = data?.schoolUpdates?.updates;

  if (!Array.isArray(events) || events.length === 0) {
    failures.push("liveData:calendar-empty");
  } else {
    const placeholders = events.filter((event) => {
      const id = String(event?.id ?? "").toLowerCase();
      const title = String(event?.title ?? event?.summary ?? "").trim().toLowerCase();
      return id.startsWith("preview-") || PLACEHOLDER_CALENDAR_TITLES.has(title);
    });
    if (placeholders.length > 0) failures.push(`liveData:calendar-placeholder:${placeholders.length}`);
  }

  if (!Array.isArray(birthdays) || birthdays.length === 0) {
    failures.push("liveData:birthdays-empty");
  } else {
    const placeholders = birthdays.filter((birthday) => {
      const id = String(birthday?.id ?? "").toLowerCase();
      const name = String(birthday?.name ?? "").trim().toLowerCase();
      return id.startsWith("preview-") || PLACEHOLDER_BIRTHDAY_NAMES.has(name);
    });
    if (placeholders.length > 0) failures.push(`liveData:birthdays-placeholder:${placeholders.length}`);
  }

  if (!Array.isArray(schoolUpdates)) {
    failures.push("liveData:school-updates-missing");
  } else {
    const placeholders = schoolUpdates.filter((update) => {
      const id = String(update?.id ?? "").toLowerCase();
      const title = String(update?.title ?? "").trim().toLowerCase();
      return id.startsWith("preview-") || PLACEHOLDER_SCHOOL_TITLES.has(title);
    });
    if (placeholders.length > 0) failures.push(`liveData:school-placeholder:${placeholders.length}`);
  }

  return {
    ok: failures.length === 0,
    failures,
    counts: {
      calendar: Array.isArray(events) ? events.length : null,
      birthdays: Array.isArray(birthdays) ? birthdays.length : null,
      schoolUpdates: Array.isArray(schoolUpdates) ? schoolUpdates.length : null,
    },
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

function postJson(url, body, timeoutMs = 4000) {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = http.request(url, {
      method: "POST",
      timeout: timeoutMs,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    }, (response) => {
      let responseBody = "";
      response.on("data", (chunk) => { responseBody += chunk; });
      response.on("end", () => {
        if ((response.statusCode ?? 500) >= 400) {
          reject(new Error(`http ${response.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(responseBody));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.on("error", reject);
    request.write(payload);
    request.end();
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

export function validateVoiceCommandParses(results) {
  const expected = new Map([
    ["Hey Homer, turn on", { action: "turn_on" }],
  ]);
  const failures = [];
  const commands = {};

  for (const result of results) {
    const transcript = result?.transcript ?? "";
    const command = result?.command ?? null;
    commands[transcript] = command;
    const wanted = expected.get(transcript);
    if (!wanted) continue;
    for (const [key, value] of Object.entries(wanted)) {
      if (command?.[key] !== value) {
        failures.push(`voiceCommands:${transcript}:${key}:${command?.[key] ?? "missing"}`);
      }
    }
  }

  return { ok: failures.length === 0, failures, commands };
}

async function checkVoiceCommands(host) {
  const transcripts = ["Hey Homer, turn on"];
  try {
    const results = await Promise.all(
      transcripts.map((transcript) => postJson(`http://${host}:8765/api/voice-command/parse`, { transcript })),
    );
    return validateVoiceCommandParses(results);
  } catch (error) {
    return { ok: false, failures: [`voiceCommands:parse-endpoint:${error.message}`], commands: {} };
  }
}

async function checkLiveData(host) {
  const [calendar, birthdays, schoolUpdates] = await Promise.allSettled([
    fetchJson(`http://${host}:8765/api/calendar`, 20000),
    fetchJson(`http://${host}:8765/api/birthdays`, 20000),
    fetchJson(`http://${host}:8765/api/school-updates`, 20000),
  ]);
  const data = {
    calendar: calendar.status === "fulfilled" ? calendar.value : null,
    birthdays: birthdays.status === "fulfilled" ? birthdays.value : null,
    schoolUpdates: schoolUpdates.status === "fulfilled" ? schoolUpdates.value : null,
  };
  const transportFailures = [];
  if (calendar.status === "rejected") transportFailures.push(`liveData:calendar:${calendar.reason.message}`);
  if (birthdays.status === "rejected") transportFailures.push(`liveData:birthdays:${birthdays.reason.message}`);
  if (schoolUpdates.status === "rejected") transportFailures.push(`liveData:school-updates:${schoolUpdates.reason.message}`);
  const validated = validateLiveData(data);
  return {
    ok: transportFailures.length === 0 && validated.ok,
    failures: [...transportFailures, ...validated.failures],
    counts: validated.counts,
  };
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

function availableLocalPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close(() => {
        if (port) resolve(port);
        else reject(new Error("no local port assigned"));
      });
    });
    server.on("error", reject);
  });
}

async function evaluateBrowserState(host, index) {
  const port = await availableLocalPort();
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
    const placeholderMarkers = redacted.placeholderMarkers ?? [];
    return {
      ok: page.url?.includes("/home-center/") && placeholderMarkers.length === 0,
      ...redacted,
      error: placeholderMarkers.length === 0
        ? null
        : `placeholder markers rendered: ${placeholderMarkers.slice(0, 5).join(", ")}`,
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
  const [dns, piApi, voiceCommands, liveData, ssh, bundle, browser] = await Promise.all([
    checkDns(node.host),
    checkPiApi(node.host),
    checkVoiceCommands(node.host),
    checkLiveData(node.host),
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
    voiceCommands,
    ssh: { ok: ssh.ok, hostname: ssh.hostname, ips: ssh.ips, error: ssh.error },
    services: ssh.services ?? {},
    bundle,
    liveData,
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
