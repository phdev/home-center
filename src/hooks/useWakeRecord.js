import { useState, useEffect, useRef } from "react";

/**
 * Polls the worker for recording status (read-only for display).
 * The Pi pushes state to KV on every change — single writer, no consistency issues.
 */
export function useWakeRecord(workerConfig) {
  const [state, setState] = useState({
    active: false, type: "positive", count: 0,
    totalPositive: 0, totalNegative: 0,
  });
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!workerConfig?.url) return;

    const poll = async () => {
      try {
        const headers = {};
        if (workerConfig.token) headers["Authorization"] = `Bearer ${workerConfig.token}`;
        const res = await fetch(`${workerConfig.url}/api/wake-record`, { headers });
        if (res.ok) setState(await res.json());
      } catch {
        // ignore
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 2000);
    return () => clearInterval(intervalRef.current);
  }, [workerConfig?.url, workerConfig?.token]);

  return state;
}
