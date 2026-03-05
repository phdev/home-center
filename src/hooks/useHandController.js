import { useState, useEffect, useRef, useCallback } from "react";

// Spatial navigation map — each panel knows its directional neighbors
const NAV_MAP = {
  calendar:    { right: "birthdays",   down: "photos",      left: null,         up: null },
  birthdays:   { right: "weather",     down: "photos",      left: "calendar",   up: null },
  weather:     { right: "worldclock",  down: "events",      left: "birthdays",  up: null },
  worldclock:  { right: "timers",      down: "events",      left: "weather",    up: null },
  timers:      { right: null,          down: "agenttasks",  left: "worldclock", up: null },
  photos:      { right: "events",      down: null,          left: "calendar",   up: "birthdays" },
  events:      { right: "agenttasks",  down: null,          left: "photos",     up: "weather" },
  agenttasks:  { right: null,          down: "fact",        left: "events",     up: "timers" },
  fact:        { right: null,          down: null,          left: "agenttasks", up: "agenttasks" },
};

// Panels that open a fullscreen page on pinch
const FULLSCREEN_MAP = {
  calendar: "calendar",
  weather: "weather",
  photos: "photos",
};

const CONNECTED_TIMEOUT = 30_000;
const STALE_THRESHOLD = 10_000;
const POLL_INTERVAL = 500;
const MIN_COLUMNS = 2;
const MAX_COLUMNS = 6;
const DEFAULT_COLUMNS = 4;

export function useHandController(workerSettings, currentPage, goTo) {
  const [selectedPanelId, setSelectedPanelId] = useState("calendar");
  const [lastGestureTime, setLastGestureTime] = useState(0);
  const [connected, setConnected] = useState(false);
  const [photoColumns, setPhotoColumns] = useState(DEFAULT_COLUMNS);
  const [photoScrollDir, setPhotoScrollDir] = useState(0);
  const [lastGesture, setLastGesture] = useState(null); // { name, hand, timestamp }

  const lastGestureIdRef = useRef(null);
  const initializedRef = useRef(false);

  const workerUrl = workerSettings?.url;
  const workerToken = workerSettings?.token;

  // Clear scroll direction after it's been consumed
  useEffect(() => {
    if (photoScrollDir !== 0) {
      const t = setTimeout(() => setPhotoScrollDir(0), 100);
      return () => clearTimeout(t);
    }
  }, [photoScrollDir]);

  const processGesture = useCallback((gesture) => {
    // Photo-specific gestures (only active on photos page)
    if (currentPage === "photos") {
      switch (gesture) {
        case "twoHandPinchOut":
          setPhotoColumns((prev) => Math.max(MIN_COLUMNS, prev - 1));
          return;
        case "twoHandPinchIn":
          setPhotoColumns((prev) => Math.min(MAX_COLUMNS, prev + 1));
          return;
        case "pinchDragUp":
          setPhotoScrollDir(-1);
          return;
        case "pinchDragDown":
          setPhotoScrollDir(1);
          return;
        default:
          break;
      }
    }

    // Spatial navigation on dashboard
    if (!currentPage || currentPage === "dashboard") {
      const navigate = (dir) => {
        setSelectedPanelId((prev) => {
          const neighbors = NAV_MAP[prev];
          return (neighbors && neighbors[dir]) || prev;
        });
      };

      switch (gesture) {
        case "waveRight":
        case "thumbSwipeRight":
          navigate("right");
          return;
        case "waveLeft":
        case "thumbSwipeLeft":
          navigate("left");
          return;
        case "waveUp":
        case "thumbSwipeUp":
          navigate("up");
          return;
        case "waveDown":
        case "thumbSwipeDown":
          navigate("down");
          return;
        case "indexThumbPinch":
          setSelectedPanelId((prev) => {
            const page = FULLSCREEN_MAP[prev];
            if (page) goTo(page);
            return prev;
          });
          return;
        default:
          break;
      }
    }

    // Global: middle-thumb pinch to go back to dashboard
    if (gesture === "middleThumbPinch") {
      if (currentPage && currentPage !== "dashboard") {
        goTo("dashboard");
      }
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

        if (g.id === lastGestureIdRef.current) return;

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
        setLastGesture({ name: g.gesture, hand: g.hand, timestamp: g.timestamp });
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

  return { connected, selectedPanelId, photoColumns, photoScrollDir, lastGesture };
}
