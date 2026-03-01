import { useState, useEffect, useCallback } from "react";

/**
 * Polls the worker for navigation commands (from voice/Pi).
 * Returns current page/view state and a goTo function for local navigation.
 */
export function useNavigation(workerSettings) {
  const [page, setPage] = useState("dashboard"); // "dashboard" | "calendar"
  const [calendarView, setCalendarView] = useState("monthly"); // "monthly" | "weekly" | "daily"
  const [lastTimestamp, setLastTimestamp] = useState(0);

  const workerUrl = workerSettings?.url;
  const workerToken = workerSettings?.token;

  // Poll for navigation commands every 2s
  useEffect(() => {
    if (!workerUrl) return;
    let active = true;

    const poll = async () => {
      try {
        const headers = {};
        if (workerToken) headers.Authorization = `Bearer ${workerToken}`;
        const res = await fetch(`${workerUrl}/api/navigate`, { headers });
        if (!res.ok) return;
        const data = await res.json();
        const nav = data.navigation;
        if (!nav || nav.timestamp <= lastTimestamp) return;

        // New navigation command received
        setLastTimestamp(nav.timestamp);
        if (nav.page) setPage(nav.page);
        if (nav.view) setCalendarView(nav.view);
      } catch {
        // silent
      }
    };

    poll();
    const id = setInterval(poll, 2000);
    return () => { active = false; clearInterval(id); };
  }, [workerUrl, workerToken, lastTimestamp]);

  const goTo = useCallback((newPage, newView) => {
    if (newPage) setPage(newPage);
    if (newView) setCalendarView(newView);
  }, []);

  return { page, calendarView, goTo };
}
