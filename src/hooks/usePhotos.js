import { useState, useEffect, useCallback } from "react";
import { fetchPhotosFromAlbum } from "../services/photos";

export function usePhotos(photoSettings, workerSettings) {
  const [photos, setPhotos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const useWorker = !!(workerSettings?.url);

  const load = useCallback(async () => {
    // If using worker, always try (worker has album token configured)
    // If not using worker, need album token in local settings
    if (!useWorker && !photoSettings.albumToken) {
      setLoading(false);
      setError(null);
      setPhotos(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (useWorker) {
        const headers = {};
        if (workerSettings.token) headers.Authorization = `Bearer ${workerSettings.token}`;
        const res = await fetch(`${workerSettings.url}/api/photos`, { headers });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Photos: worker returned ${res.status}`);
        }
        const data = await res.json();
        if (!data.photos || data.photos.length === 0) {
          throw new Error("No photos found in album.");
        }
        setPhotos(data.photos);
      } else {
        const result = await fetchPhotosFromAlbum(
          photoSettings.albumToken,
          photoSettings.corsProxy,
        );
        if (result.length === 0) {
          throw new Error("No photos found in album.");
        }
        setPhotos(result);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [
    useWorker,
    workerSettings?.url,
    workerSettings?.token,
    photoSettings.albumToken,
    photoSettings.corsProxy,
  ]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  return { photos, loading, error, refresh: load };
}
