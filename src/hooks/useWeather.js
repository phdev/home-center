import { useState, useEffect, useCallback } from "react";
import { fetchWeather, getLocationCoords } from "../services/weather";

export function useWeather(weatherSettings) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let { lat, lng } = weatherSettings;

      if (!lat || !lng) {
        if (weatherSettings.autoLocate) {
          try {
            const coords = await getLocationCoords();
            lat = coords.lat;
            lng = coords.lng;
          } catch {
            throw new Error("Location unavailable. Set coordinates in settings.");
          }
        } else {
          throw new Error("No location configured.");
        }
      }

      const result = await fetchWeather(lat, lng, weatherSettings.units);
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [weatherSettings.lat, weatherSettings.lng, weatherSettings.units, weatherSettings.autoLocate]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  return { data, loading, error, refresh: load };
}
