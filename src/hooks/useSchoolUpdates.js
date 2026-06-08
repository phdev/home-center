import { useState, useEffect, useCallback } from "react";
import { credentialsForUrl } from "../data/_storage";
import { apiHeaders, apiUrl } from "../services/piLocal";

const POLL_MS = 15 * 1000;

export function useSchoolUpdates(workerSettings) {
  const [updates, setUpdates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async ({ showLoading = true } = {}) => {
    if (!workerSettings?.url) {
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const url = apiUrl(workerSettings.url, "/api/school-updates");
      const headers = apiHeaders(workerSettings.token);
      const res = await fetch(url, {
        headers,
        credentials: credentialsForUrl(url),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `School updates: worker returned ${res.status}`);
      }
      const data = await res.json();
      setUpdates(data.updates || []);
    } catch (e) {
      setError(e.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [workerSettings?.url, workerSettings?.token]);

  useEffect(() => {
    load();
    // Voice commands can dismiss Needs Action school items outside this tab.
    const interval = setInterval(() => load({ showLoading: false }), POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  return { updates, loading, error, refresh: load };
}
