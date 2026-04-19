import { useEffect, useState, useCallback } from "react";

/**
 * Takeout decision for tonight.
 *
 * Reads `{date, decision, vendor?}` from the worker `/api/takeout/today`.
 * Falls back to localStorage so the card works before the worker endpoint
 * exists. Exposes `setDecision` so the UI can write locally + optimistically.
 *
 * @param {{url?:string, token?:string}} [workerSettings]
 * @returns {import('../state/types').TakeoutDecision | null}
 */
export function useTakeout(workerSettings) {
  const [today, setToday] = useState(() => readLocal());

  useEffect(() => {
    let cancelled = false;
    if (!workerSettings?.url) return;
    (async () => {
      try {
        const res = await fetch(`${workerSettings.url}/api/takeout/today`, {
          headers: workerSettings.token
            ? { Authorization: `Bearer ${workerSettings.token}` }
            : {},
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data && typeof data === "object") {
          setToday(data);
          writeLocal(data);
        }
      } catch {
        // silent — fall back to local
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workerSettings?.url, workerSettings?.token]);

  return today;
}

/** @returns {(patch:Partial<import('../state/types').TakeoutDecision>)=>void} */
export function useTakeoutWriter() {
  return useCallback((patch) => {
    const prev = readLocal() ?? { date: todayKey(), decision: null };
    const next = { ...prev, ...patch, decidedAt: new Date().toISOString() };
    writeLocal(next);
    window.dispatchEvent(new CustomEvent("hc:takeout-updated", { detail: next }));
  }, []);
}

function todayKey() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function readLocal() {
  try {
    const raw = localStorage.getItem("hc:takeout");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.date !== todayKey()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocal(d) {
  try {
    localStorage.setItem("hc:takeout", JSON.stringify(d));
  } catch {}
}
