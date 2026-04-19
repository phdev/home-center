import { useEffect, useState, useCallback } from "react";
import { readWithFallback, writeWithFallback } from "./_storage";

const LOCAL_KEY = "hc:takeout";

/**
 * Today's takeout decision.
 *
 * Routing through readWithFallback/writeWithFallback keeps components and
 * cards source-agnostic — they never know whether the value came from the
 * worker or localStorage.
 *
 * @param {{url?:string, token?:string}} [workerSettings]
 * @returns {import('../state/types').TakeoutDecision | null}
 */
export function useTakeout(workerSettings) {
  const [today, setToday] = useState(() => readLocal());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await readWithFallback({
        workerSettings,
        path: "/api/takeout/today",
        readLocal,
        writeLocal,
        parse: (d) => (d && typeof d === "object" && d.date === todayKey() ? d : null),
      });
      if (!cancelled && data) setToday(data);
    })();
    // Listen for same-tab writes so multiple components stay in sync.
    const handler = (e) => setToday(e.detail);
    window.addEventListener("hc:takeout-updated", handler);
    return () => {
      cancelled = true;
      window.removeEventListener("hc:takeout-updated", handler);
    };
  }, [workerSettings?.url, workerSettings?.token]);

  return today;
}

/**
 * Returns a writer that persists via the worker with localStorage fallback.
 * Components call this without knowing the storage source.
 */
export function useTakeoutWriter(workerSettings) {
  return useCallback(
    async (patch) => {
      const prev = readLocal() ?? { date: todayKey(), decision: null };
      const next = { ...prev, ...patch, decidedAt: new Date().toISOString() };
      await writeWithFallback({
        workerSettings,
        path: "/api/takeout/today",
        method: "POST",
        body: next,
        writeLocalOnFailure: () => writeLocal(next),
        writeLocalOnSuccess: () => writeLocal(next),
      });
      window.dispatchEvent(new CustomEvent("hc:takeout-updated", { detail: next }));
      return next;
    },
    [workerSettings?.url, workerSettings?.token],
  );
}

function todayKey() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function readLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
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
    localStorage.setItem(LOCAL_KEY, JSON.stringify(d));
  } catch {}
}
