import { useState, useEffect, useCallback } from "react";
import { fetchPhotosFromAlbum } from "../services/photos";

export function usePhotos(photoSettings) {
  const [photos, setPhotos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!photoSettings.albumToken) {
      setLoading(false);
      setError(null);
      setPhotos(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPhotosFromAlbum(
        photoSettings.albumToken,
        photoSettings.corsProxy,
      );
      if (result.length === 0) {
        throw new Error("No photos found in album.");
      }
      setPhotos(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [photoSettings.albumToken, photoSettings.corsProxy]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  return { photos, loading, error, refresh: load };
}
