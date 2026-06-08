import { useState, useEffect, useCallback } from "react";
import { credentialsForUrl } from "../data/_storage";
import { apiHeaders, apiUrl } from "../services/piLocal";

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
      const url = apiUrl(workerSettings.url, "/api/birthdays");
      const headers = apiHeaders(workerSettings.token);
      const res = await fetch(url, {
        headers,
        credentials: credentialsForUrl(url),
      });
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
    // Gift status can change from voice commands on the Pi.
    const interval = setInterval(load, 30 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  return { birthdays, loading, error, refresh: load };
}
