import { useState, useEffect, useCallback } from "react";

export function useBirthdays(workerSettings) {
  const [birthdays, setBirthdays] = useState(null);
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
      const res = await fetch(`${workerSettings.url}/api/birthdays`, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Birthdays: worker returned ${res.status}`);
      }
      const data = await res.json();
      setBirthdays(data.birthdays || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [workerSettings?.url, workerSettings?.token]);

  useEffect(() => {
    load();
    // Refresh every 6 hours (birthdays don't change often)
    const interval = setInterval(load, 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  return { birthdays, loading, error, refresh: load };
}
