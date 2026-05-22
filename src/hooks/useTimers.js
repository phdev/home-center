import { useState, useEffect, useCallback } from "react";
import { apiUrl, apiHeaders } from "../services/piLocal";

export function useTimers(workerSettings) {
  const [timers, setTimers] = useState([]);
  const workerUrl = workerSettings?.url;
  const workerToken = workerSettings?.token;

  // Poll server every 5s
  const poll = useCallback(async () => {
    const url = apiUrl(workerUrl, "/api/timers");
    if (!url) return;
    try {
      const res = await fetch(url, { headers: apiHeaders(workerToken) });
      if (!res.ok) return;
      const data = await res.json();
      setTimers(data.timers || []);
    } catch {
      // silent
    }
  }, [workerUrl, workerToken]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [poll]);

  // Tick every 1s to recompute `remaining` for display
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Compute remaining + expired for each timer
  const computed = timers.map((t) => {
    const remaining = Math.max(0, Math.floor((t.expiresAt - Date.now()) / 1000));
    return { ...t, remaining, expired: remaining === 0 && !t.dismissed };
  });

  const expiredTimers = computed.filter((t) => t.expired);

  const addTimer = useCallback(
    async (name, seconds) => {
      const url = apiUrl(workerUrl, "/api/timers");
      if (!url) return;
      try {
        await fetch(url, {
          method: "POST",
          headers: apiHeaders(workerToken),
          body: JSON.stringify({ name, totalSeconds: seconds, source: "dashboard" }),
        });
        poll();
      } catch {
        // silent
      }
    },
    [workerUrl, workerToken, poll],
  );

  const dismissTimer = useCallback(
    async (id) => {
      const url = apiUrl(workerUrl, `/api/timers/${encodeURIComponent(id)}/dismiss`);
      if (!url) return;
      try {
        await fetch(url, {
          method: "POST",
          headers: apiHeaders(workerToken),
        });
        poll();
      } catch {
        // silent
      }
    },
    [workerUrl, workerToken, poll],
  );

  const dismissAll = useCallback(async () => {
    const url = apiUrl(workerUrl, "/api/timers/dismiss-all");
    if (!url) return;
    try {
      await fetch(url, {
        method: "POST",
        headers: apiHeaders(workerToken),
      });
      poll();
    } catch {
      // silent
    }
  }, [workerUrl, workerToken, poll]);

  return { timers: computed, expiredTimers, addTimer, dismissTimer, dismissAll };
}
