import { useState, useEffect, useCallback } from "react";
import { fetchCalendarEvents } from "../services/calendar";

export function useCalendar(calendarSettings) {
  const [events, setEvents] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!calendarSettings.urls || calendarSettings.urls.length === 0) {
      setLoading(false);
      setError(null);
      setEvents(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCalendarEvents(
        calendarSettings.urls,
        calendarSettings.corsProxy,
      );
      setEvents(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [calendarSettings.urls?.join(","), calendarSettings.corsProxy]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  return { events, loading, error, refresh: load };
}
