import { useState, useEffect, useRef, useCallback } from "react";

export const PANEL_ORDER = [
  { id: "calendar",   fullscreenPage: "calendar" },
  { id: "birthdays",  fullscreenPage: null },
  { id: "weather",    fullscreenPage: "weather" },
  { id: "worldclock", fullscreenPage: null },
  { id: "photo",      fullscreenPage: "photos" },
  { id: "events",     fullscreenPage: null },
  { id: "timers",     fullscreenPage: null },
  { id: "agenttasks", fullscreenPage: null },
  { id: "fact",       fullscreenPage: null },
];

const CONNECTED_TIMEOUT = 30_000; // 30s without gesture = disconnected
const STALE_THRESHOLD = 10_000;   // ignore gestures older than 10s on first load
const POLL_INTERVAL = 500;

export function useHandController(workerSettings, currentPage, goTo) {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [lastGestureTime, setLastGestureTime] = useState(0);
  const [connected, setConnected] = useState(false);

  const lastGestureIdRef = useRef(null);
  const initializedRef = useRef(false);

  const workerUrl = workerSettings?.url;
  const workerToken = workerSettings?.token;

  const processGesture = useCallback((gesture) => {
    switch (gesture) {
      case "waveRight":
        setSelectedIndex((prev) =>
          prev < 0 ? 0 : (prev + 1) % PANEL_ORDER.length
        );
        break;
      case "waveLeft":
        setSelectedIndex((prev) =>
          prev < 0
            ? PANEL_ORDER.length - 1
            : (prev - 1 + PANEL_ORDER.length) % PANEL_ORDER.length
        );
        break;
      case "indexThumbPinch":
        setSelectedIndex((prev) => {
          if (prev >= 0) {
            const panel = PANEL_ORDER[prev];
            if (panel.fullscreenPage) {
              goTo(panel.fullscreenPage);
            }
          }
          return prev;
        });
        break;
      case "middleThumbPinch":
        if (currentPage && currentPage !== "dashboard") {
          goTo("dashboard");
        }
        break;
      default:
        break;
    }
  }, [currentPage, goTo]);

  // Poll for gestures
  useEffect(() => {
    if (!workerUrl) return;

    const poll = async () => {
      try {
        const headers = {};
        if (workerToken) headers.Authorization = `Bearer ${workerToken}`;
        const res = await fetch(`${workerUrl}/api/gesture`, { headers });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.gesture) return;

        const g = data.gesture;

        // Skip if already processed
        if (g.id === lastGestureIdRef.current) return;

        // On first load, skip stale gestures (just record the ID)
        const age = Date.now() - g.timestamp;
        if (!initializedRef.current) {
          initializedRef.current = true;
          if (age > STALE_THRESHOLD) {
            lastGestureIdRef.current = g.id;
            return;
          }
        }

        lastGestureIdRef.current = g.id;
        setLastGestureTime(g.timestamp);
        processGesture(g.gesture);
      } catch {
        // silent
      }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [workerUrl, workerToken, processGesture]);

  // Update connected state based on gesture recency
  useEffect(() => {
    if (lastGestureTime === 0) {
      setConnected(false);
      return;
    }

    setConnected(true);

    const remaining = CONNECTED_TIMEOUT - (Date.now() - lastGestureTime);
    if (remaining <= 0) {
      setConnected(false);
      return;
    }

    const timer = setTimeout(() => setConnected(false), remaining);
    return () => clearTimeout(timer);
  }, [lastGestureTime]);

  const selectedPanelId = connected && selectedIndex >= 0
    ? PANEL_ORDER[selectedIndex].id
    : null;

  return { connected, selectedPanelId };
}
