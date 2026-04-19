/**
 * Shared storage primitives for data adapters.
 *
 * Contract (see docs/home_center_decisions_log.md — "Separate ingestion from
 * rendering"):
 *
 *   - All worker-vs-localStorage routing lives HERE (plus the per-adapter
 *     wrappers that call this). Components / cards never see the difference.
 *   - Worker is tried first when a URL is configured; any failure (offline,
 *     non-2xx, timeout) falls back to localStorage.
 *   - Writes go to both on success, so a later `read()` returns the right
 *     thing even if the worker becomes unavailable mid-session.
 */

const DEFAULT_TIMEOUT_MS = 6_000;

/**
 * Fetch JSON with a timeout; returns null on any failure.
 * @param {string} url
 * @param {RequestInit} init
 * @param {number} timeoutMs
 */
async function fetchJson(url, init, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Worker-first read; falls back to `readLocal()` when the worker is
 * unreachable or unconfigured. Keeps localStorage in sync on success.
 *
 * @template T
 * @param {Object} params
 * @param {{url?:string, token?:string}|undefined} params.workerSettings
 * @param {string} params.path                 — e.g. "/api/takeout/today"
 * @param {() => T|null} params.readLocal
 * @param {(value:T) => void} params.writeLocal
 * @param {(data:any) => T|null} [params.parse] — shape-validate worker response
 * @returns {Promise<T|null>}
 */
export async function readWithFallback({
  workerSettings,
  path,
  readLocal,
  writeLocal,
  parse = (x) => x,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  if (!workerSettings?.url) return readLocal();
  const data = await fetchJson(
    `${workerSettings.url}${path}`,
    { headers: authHeaders(workerSettings.token) },
    timeoutMs,
  );
  const parsed = data == null ? null : parse(data);
  if (parsed != null) {
    writeLocal(parsed);
    return parsed;
  }
  return readLocal();
}

/**
 * Worker-first write; on failure, persists to localStorage so the decision
 * survives a reload even if the worker is down. Returns
 * `{ source: 'worker'|'local'|'both', data? }`.
 *
 * @template T
 * @param {Object} params
 * @param {{url?:string, token?:string}|undefined} params.workerSettings
 * @param {string} params.path
 * @param {"POST"|"PATCH"|"PUT"} [params.method]
 * @param {any} params.body
 * @param {() => void} params.writeLocalOnFailure
 * @param {() => void} [params.writeLocalOnSuccess]
 */
export async function writeWithFallback({
  workerSettings,
  path,
  method = "POST",
  body,
  writeLocalOnFailure,
  writeLocalOnSuccess,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  // Always mirror to localStorage on success so an offline read still works.
  const persistLocal = writeLocalOnSuccess ?? writeLocalOnFailure;
  if (!workerSettings?.url) {
    writeLocalOnFailure?.();
    return { source: "local" };
  }
  const data = await fetchJson(
    `${workerSettings.url}${path}`,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(workerSettings.token),
      },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
  if (data == null) {
    writeLocalOnFailure?.();
    return { source: "local" };
  }
  persistLocal?.();
  return { source: "both", data };
}
