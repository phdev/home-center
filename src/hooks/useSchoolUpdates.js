import { useState, useEffect, useCallback } from "react";

export function useSchoolUpdates(workerSettings) {
  const [updates, setUpdates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!workerSettings?.url) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const headers = {};
      if (workerSettings.token) headers.Authorization = `Bearer ${workerSettings.token}`;
      const res = await fetch(`${workerSettings.url}/api/school-updates`, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `School updates: worker returned ${res.status}`);
      }
      const data = await res.json();
      setUpdates(data.updates || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [workerSettings?.url, workerSettings?.token]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  return { updates, loading, error, refresh: load };
}
