import { useState, useEffect, useRef } from "react";
import { apiUrl, apiHeaders } from "../services/piLocal";

const POLL_INTERVAL = 2000;
const MAX_EVENTS = 50;

export function useWakeWordDebug(workerSettings) {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const [visible, setVisible] = useState(true);
  const sinceRef = useRef(Date.now());
  const lastPollRef = useRef(0);

  const workerUrl = workerSettings?.url;
  const workerToken = workerSettings?.token;

  useEffect(() => {
    const baseUrl = apiUrl(workerUrl, "/api/wake-debug");
    if (!baseUrl) return;

    const poll = async () => {
      try {
        const res = await fetch(
          `${baseUrl}?since=${sinceRef.current}`,
          { headers: apiHeaders(workerToken) }
        );
        if (!res.ok) {
          setConnected(false);
          return;
        }
        const data = await res.json();
        setConnected(true);
        lastPollRef.current = Date.now();

        if (data.events && data.events.length > 0) {
          // Check for show/hide debug commands
          for (const e of data.events) {
            if (e.type === "debug_hide") setVisible(false);
            if (e.type === "debug_show") setVisible(true);
          }
          setEvents((prev) => {
            const merged = [...prev, ...data.events.filter((e) => e.type !== "debug_hide" && e.type !== "debug_show")];
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

  return { events, connected, visible, clearEvents };
}
