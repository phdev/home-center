/**
 * OpenClaw enhancement helper.
 *
 * Contract (see docs/home_center_decisions_log.md — "OpenClaw is enrichment,
 * not dependency"):
 *
 *   - `enhance(feature, state)` returns an EnhancementResponse.
 *   - On network error, timeout, or missing worker config, returns
 *     `{fields: {}, source: 'fallback'}` — never throws.
 *   - Card code must render fine with an empty `fields` object.
 *
 * The actual LLM prompt lives server-side at the worker (`/api/claw/enhance`)
 * so we don't leak prompts into the bundle and can iterate on wording without
 * shipping JS.
 */

const DEFAULT_TIMEOUT_MS = 6_000;

/** @typedef {import('../state/types').EnhancementRequest} EnhancementRequest */
/** @typedef {import('../state/types').EnhancementResponse} EnhancementResponse */

/**
 * @param {EnhancementRequest} req
 * @param {{url?:string, token?:string}} workerSettings
 * @returns {Promise<EnhancementResponse>}
 */
export async function enhance(req, workerSettings) {
  if (!workerSettings?.url) {
    return { fields: {}, source: "fallback", error: "no-worker-url" };
  }
  const ctrl = new AbortController();
  const timeoutMs = req.opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${workerSettings.url}/api/claw/enhance`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        ...(workerSettings.token
          ? { Authorization: `Bearer ${workerSettings.token}` }
          : {}),
      },
      body: JSON.stringify({ feature: req.feature, state: req.state }),
    });
    if (!res.ok) {
      return { fields: {}, source: "fallback", error: `http-${res.status}` };
    }
    const data = await res.json();
    return { fields: data?.fields ?? {}, source: "openclaw" };
  } catch (e) {
    return {
      fields: {},
      source: "fallback",
      error: e?.name === "AbortError" ? "timeout" : String(e?.message ?? e),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Small React helper: fetches an enhancement for a given feature + state,
 * caches the result in a ref keyed by JSON(state), and returns
 * `{fields, source}`. Cards can call this on mount without thinking about
 * debouncing or cancellation — identity of the state slice drives the fetch.
 */
import { useEffect, useState, useRef } from "react";

/**
 * @param {string} feature
 * @param {any} state
 * @param {{url?:string, token?:string}} workerSettings
 * @param {{enabled?:boolean, timeoutMs?:number}} [opts]
 */
export function useEnhancement(feature, state, workerSettings, opts = {}) {
  const [result, setResult] = useState(
    /** @type {EnhancementResponse} */ ({ fields: {}, source: "fallback" }),
  );
  const cacheRef = useRef(new Map());
  const enabled = opts.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;
    const key = `${feature}:${safeStringify(state)}`;
    const cached = cacheRef.current.get(key);
    if (cached) {
      setResult(cached);
      return;
    }
    let cancelled = false;
    (async () => {
      const r = await enhance(
        { feature, state, opts: { timeoutMs: opts.timeoutMs } },
        workerSettings,
      );
      if (cancelled) return;
      cacheRef.current.set(key, r);
      setResult(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [feature, safeStringify(state), enabled, opts.timeoutMs, workerSettings?.url]);

  return result;
}

function safeStringify(v) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
