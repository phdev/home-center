import { useState, useEffect, useCallback } from "react";
import { fetchCalendarEvents } from "../services/calendar";

export function useCalendar(calendarSettings, workerSettings) {
  const [events, setEvents] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const useWorker = !!(workerSettings?.url);

  const load = useCallback(async () => {
    // If using worker, always try (worker has its own CalDAV credentials)
    // If not using worker, need at least one URL configured
    if (!useWorker && (!calendarSettings.urls || calendarSettings.urls.length === 0)) {
      setLoading(false);
      setError(null);
      setEvents(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (useWorker) {
        const headers = {};
        if (workerSettings.token) headers.Authorization = `Bearer ${workerSettings.token}`;
        const res = await fetch(`${workerSettings.url}/api/calendar`, { headers });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Worker error: ${res.status}`);
        }
        const data = await res.json();
        setEvents(data.events || []);
      } else {
        const result = await fetchCalendarEvents(
          calendarSettings.urls,
          calendarSettings.corsProxy,
        );
        setEvents(result);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [
    useWorker,
    workerSettings?.url,
    workerSettings?.token,
    calendarSettings.urls?.join(","),
    calendarSettings.corsProxy,
  ]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  return { events, loading, error, refresh: load };
}
