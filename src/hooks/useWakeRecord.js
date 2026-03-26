import { useState, useEffect, useRef } from "react";

/**
 * Polls the Pi's local HTTP server directly for recording status.
 * No worker KV — instant, always consistent.
 * Requires Chromium --allow-insecure-localhost flag on the Pi.
 */
export function useWakeRecord() {
  const [state, setState] = useState({
    active: false, type: "positive", count: 0,
    totalPositive: 0, totalNegative: 0,
  });
  const intervalRef = useRef(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("http://localhost:8765/status");
        if (res.ok) setState(await res.json());
      } catch {
        // Pi offline — ignore
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 2000);
    return () => clearInterval(intervalRef.current);
  }, []);

  return state;
}
