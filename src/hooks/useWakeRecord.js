import { useState, useEffect, useRef } from "react";

const PI_URL = "http://localhost:8765";

/**
 * Polls the Pi's local HTTP server for recording status.
 * No Cloudflare KV — direct connection, instant state.
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
        const res = await fetch(`${PI_URL}/status`);
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
