import { useState, useEffect, useRef } from "react";

const POLL_INTERVAL = 2000;
const MAX_EVENTS = 50;

export function useWakeWordDebug(workerSettings) {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const sinceRef = useRef(Date.now());
  const lastPollRef = useRef(0);

  const workerUrl = workerSettings?.url;
  const workerToken = workerSettings?.token;

  useEffect(() => {
    if (!workerUrl) return;

    const poll = async () => {
      try {
        const headers = {};
        if (workerToken) headers.Authorization = `Bearer ${workerToken}`;
        const res = await fetch(
          `${workerUrl}/api/wake-debug?since=${sinceRef.current}`,
          { headers }
        );
        if (!res.ok) {
          setConnected(false);
          return;
        }
        const data = await res.json();
        setConnected(true);
        lastPollRef.current = Date.now();

        if (data.events && data.events.length > 0) {
          setEvents((prev) => {
            const merged = [...prev, ...data.events];
            // Deduplicate by timestamp+type
            const seen = new Set();
            const unique = merged.filter((e) => {
              const key = `${e.timestamp}-${e.type}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            // Keep latest MAX_EVENTS
            return unique.slice(-MAX_EVENTS);
          });
          // Advance since to latest event timestamp
          const latest = data.events[data.events.length - 1];
          if (latest) sinceRef.current = latest.timestamp;
        }
      } catch {
        setConnected(false);
      }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [workerUrl, workerToken]);

  const clearEvents = () => {
    setEvents([]);
    sinceRef.current = Date.now();
  };

  return { events, connected, clearEvents };
}
