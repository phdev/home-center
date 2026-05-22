import { useState, useEffect, useCallback } from "react";

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
      const headers = {};
      if (workerSettings.token) headers.Authorization = `Bearer ${workerSettings.token}`;
      const res = await fetch(`${workerSettings.url}/api/notifications`, { headers });
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
    const headers = { "Content-Type": "application/json" };
    if (workerSettings.token) headers.Authorization = `Bearer ${workerSettings.token}`;
    try {
      await fetch(`${workerSettings.url}/api/notifications/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers,
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
