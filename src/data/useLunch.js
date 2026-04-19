import { useEffect, useState, useCallback } from "react";
import { readWithFallback, writeWithFallback } from "./_storage";

const LOCAL_KEY = "hc:lunchDecisions";

/**
 * Lunch decisions per date.
 *
 * Shape: `{ [date]: { date, perChild: { emma: 'school', jack: 'home' } } }`.
 * Routing through the shared storage helper keeps components source-agnostic.
 *
 * @param {{url?:string, token?:string}} [workerSettings]
 * @returns {Object.<string, import('../state/types').LunchDecision>}
 */
export function useLunchDecisions(workerSettings) {
  const [decisions, setDecisions] = useState(() => readLocal());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await readWithFallback({
        workerSettings,
        path: "/api/lunch/decisions",
        readLocal,
        writeLocal,
        parse: (d) => (d && typeof d === "object" ? d : null),
      });
      if (!cancelled && data) setDecisions(data);
    })();
    const handler = (e) => setDecisions(e.detail);
    window.addEventListener("hc:lunch-updated", handler);
    return () => {
      cancelled = true;
      window.removeEventListener("hc:lunch-updated", handler);
    };
  }, [workerSettings?.url, workerSettings?.token]);

  return decisions;
}

export function useLunchWriter(workerSettings) {
  return useCallback(
    /** @param {string} dateISO @param {{child:string, choice:'school'|'home'|null}} payload */
    async (dateISO, { child, choice }) => {
      const all = readLocal() ?? {};
      const existing = all[dateISO] ?? { date: dateISO, perChild: {} };
      const next = {
        ...all,
        [dateISO]: {
          ...existing,
          perChild: { ...existing.perChild, [child]: choice },
        },
      };
      await writeWithFallback({
        workerSettings,
        path: "/api/lunch/decisions",
        method: "POST",
        body: { date: dateISO, child, choice },
        writeLocalOnFailure: () => writeLocal(next),
        writeLocalOnSuccess: () => writeLocal(next),
      });
      window.dispatchEvent(new CustomEvent("hc:lunch-updated", { detail: next }));
      return next;
    },
    [workerSettings?.url, workerSettings?.token],
  );
}

function readLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocal(d) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(d));
  } catch {}
}
