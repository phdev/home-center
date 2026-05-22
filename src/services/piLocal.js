export const PI_LOCAL_URL = "http://localhost:8765";

export function isOnPi() {
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "homecenter.local";
}

/**
 * Get the base URL for an API endpoint. On the Pi, use localhost:8765.
 * Off the Pi, use the worker URL.
 */
export function apiUrl(workerUrl, path) {
  if (isOnPi()) return `${PI_LOCAL_URL}${path}`;
  return workerUrl ? `${workerUrl}${path}` : null;
}

/**
 * Build headers. No auth needed for local, add bearer token for worker.
 */
export function apiHeaders(workerToken) {
  const h = { "Content-Type": "application/json" };
  if (!isOnPi() && workerToken) h.Authorization = `Bearer ${workerToken}`;
  return h;
}
