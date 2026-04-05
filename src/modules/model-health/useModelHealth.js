import { useState, useEffect, useCallback } from "react";

// Polls dashboard-state.json every 30 seconds for ambient model health display
export function useModelHealth() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      // In dev, fetch from the local file system via Vite proxy or public dir
      // In production, fetch from the known path
      const paths = [
        "/home-center/dashboard/data/current-state.json",
        "/dashboard/data/current-state.json",
        "/openclaw/logs/dashboard-state.json",
      ];
      let result = null;
      for (const path of paths) {
        try {
          const res = await fetch(path);
          if (res.ok) {
            result = await res.json();
            break;
          }
        } catch {
          continue;
        }
      }
      if (result) {
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
