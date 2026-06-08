import { useState, useEffect, useCallback } from "react";
import { apiHeaders, apiUrl } from "../services/piLocal";

export function useNotifications(workerSettings) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const hasWorker = !!(workerSettings?.url);

  const load = useCallback(async () => {
    if (!hasWorker) {
      setLoading(false);
      return;
    }
    try {
      const url = apiUrl(workerSettings.url, "/api/notifications");
      const res = await fetch(url, { headers: apiHeaders(workerSettings.token) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Notifications: worker returned ${res.status}`);
      }
      const data = await res.json();
      setNotifications(data.notifications || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [hasWorker, workerSettings?.url, workerSettings?.token]);

  const dismiss = useCallback(async (id) => {
    if (!hasWorker) return;
    const url = apiUrl(workerSettings.url, `/api/notifications/${encodeURIComponent(id)}`);
    try {
      await fetch(url, {
        method: "DELETE",
        headers: apiHeaders(workerSettings.token),
      });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      console.error("Failed to dismiss notification:", e);
    }
  }, [hasWorker, workerSettings?.url, workerSettings?.token]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60 * 1000); // Poll every minute
    return () => clearInterval(interval);
  }, [load]);

  return { notifications, loading, error, dismiss, refresh: load };
}
