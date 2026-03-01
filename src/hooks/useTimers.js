import { useState, useEffect, useCallback } from "react";

export function useTimers(workerSettings) {
  const [timers, setTimers] = useState([]);
  const workerUrl = workerSettings?.url;
  const workerToken = workerSettings?.token;

  const headers = useCallback(() => {
    const h = { "Content-Type": "application/json" };
    if (workerToken) h.Authorization = `Bearer ${workerToken}`;
    return h;
  }, [workerToken]);

  // Poll server every 5s
  const poll = useCallback(async () => {
    if (!workerUrl) return;
    try {
      const res = await fetch(`${workerUrl}/api/timers`, { headers: headers() });
      if (!res.ok) return;
      const data = await res.json();
      setTimers(data.timers || []);
    } catch {
      // silent
    }
  }, [workerUrl, headers]);

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
      if (!workerUrl) return;
      try {
        await fetch(`${workerUrl}/api/timers`, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({ name, totalSeconds: seconds, source: "dashboard" }),
        });
        poll();
      } catch {
        // silent
      }
    },
    [workerUrl, headers, poll],
  );

  const dismissTimer = useCallback(
    async (id) => {
      if (!workerUrl) return;
      try {
        await fetch(`${workerUrl}/api/timers/${encodeURIComponent(id)}/dismiss`, {
          method: "POST",
          headers: headers(),
        });
        poll();
      } catch {
        // silent
      }
    },
    [workerUrl, headers, poll],
  );

  const dismissAll = useCallback(async () => {
    if (!workerUrl) return;
    try {
      await fetch(`${workerUrl}/api/timers/dismiss-all`, {
        method: "POST",
        headers: headers(),
      });
      poll();
    } catch {
      // silent
    }
  }, [workerUrl, headers, poll]);

  return { timers: computed, expiredTimers, addTimer, dismissTimer, dismissAll };
}
