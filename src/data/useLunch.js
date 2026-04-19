import { useEffect, useState, useCallback } from "react";

/**
 * Lunch decisions per date, keyed by ISO date string.
 *
 * Shape:
 *   {
 *     '2026-04-20': { date, perChild: { emma: 'school', jack: 'home' } },
 *   }
 *
 * Reads from worker `/api/lunch/decisions` when available, otherwise
 * localStorage. Writes flow through useLunchWriter and optimistically
 * update localStorage.
 *
 * @param {{url?:string, token?:string}} [workerSettings]
 * @returns {Object.<string, import('../state/types').LunchDecision>}
 */
export function useLunchDecisions(workerSettings) {
  const [decisions, setDecisions] = useState(() => readLocal());

  useEffect(() => {
    let cancelled = false;
    if (!workerSettings?.url) return;
    (async () => {
      try {
        const res = await fetch(`${workerSettings.url}/api/lunch/decisions`, {
          headers: workerSettings.token
            ? { Authorization: `Bearer ${workerSettings.token}` }
            : {},
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data && typeof data === "object") {
          setDecisions(data);
          writeLocal(data);
        }
      } catch {
        // silent
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workerSettings?.url, workerSettings?.token]);

  return decisions;
}

export function useLunchWriter() {
  return useCallback(
    /** @param {string} dateISO @param {{child:string, choice:'school'|'home'}} payload */
    (dateISO, { child, choice }) => {
      const all = readLocal() ?? {};
      const existing = all[dateISO] ?? { date: dateISO, perChild: {} };
      const next = {
        ...all,
        [dateISO]: {
          ...existing,
          perChild: { ...existing.perChild, [child]: choice },
        },
      };
      writeLocal(next);
      window.dispatchEvent(new CustomEvent("hc:lunch-updated", { detail: next }));
    },
    [],
  );
}

function readLocal() {
  try {
    const raw = localStorage.getItem("hc:lunchDecisions");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocal(d) {
  try {
    localStorage.setItem("hc:lunchDecisions", JSON.stringify(d));
  } catch {}
}
