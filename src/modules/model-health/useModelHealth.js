import { useState, useEffect, useCallback } from "react";

// Polls model health state every 30 seconds for ambient TV display
// Data source: public/data/model-health.json (copied from openclaw/logs/dashboard-state.json by sync script)
export function useModelHealth() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      // Vite base path is /home-center/ in production, / in dev
      const base = import.meta.env.BASE_URL || "/";
      const res = await fetch(`${base}data/model-health.json`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
        setError(null);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  return { data, loading, error, refresh: load };
}
