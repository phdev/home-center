import { useState, useEffect, useRef } from "react";

/**
 * Polls /api/wake-record for voice sample recording mode status.
 * Returns { active, type, count }.
 */
export function useWakeRecord(workerConfig) {
  const [state, setState] = useState({ active: false, type: "positive", count: 0 });
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!workerConfig?.url) return;

    const poll = async () => {
      try {
        const headers = {};
        if (workerConfig.token) headers["Authorization"] = `Bearer ${workerConfig.token}`;
        const res = await fetch(`${workerConfig.url}/api/wake-record`, { headers });
        if (res.ok) {
          const data = await res.json();
          setState(data);
        }
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
