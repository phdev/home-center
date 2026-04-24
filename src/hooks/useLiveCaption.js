import { useState, useEffect } from "react";
import { apiUrl, apiHeaders } from "../services/piLocal";

/**
 * Polls the Pi's /api/transcription for the Mac mini voice-service's
 * live Whisper output. Returns { text, isWake, ts, age } where `age` is
 * seconds since the last update (so the UI can fade captions after idle).
 */
export function useLiveCaption(workerSettings, { pollMs = 150 } = {}) {
  const [state, setState] = useState({ text: "", isWake: false, ts: 0 });
  const [now, setNow] = useState(() => Date.now() / 1000);

  const workerUrl = workerSettings?.url;
  const workerToken = workerSettings?.token;

  useEffect(() => {
    const url = apiUrl(workerUrl, "/api/transcription");
    if (!url) return;
    let active = true;

    const poll = async () => {
      try {
        const res = await fetch(url, { headers: apiHeaders(workerToken) });
        if (!res.ok || !active) return;
        const data = await res.json();
        if (!data || typeof data.text !== "string") return;
        setState((prev) =>
          prev.ts === data.ts && prev.text === data.text
            ? prev
            : { text: data.text, isWake: !!data.is_wake, ts: data.ts || 0 }
        );
      } catch {
        // silent — Pi may be momentarily offline
      }
    };

    poll();
    const id = setInterval(poll, pollMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [workerUrl, workerToken, pollMs]);

  // Tick a clock so consumers can render age-based fades without re-polling.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 250);
    return () => clearInterval(id);
  }, []);

  return {
    text: state.text,
    isWake: state.isWake,
    ts: state.ts,
    age: state.ts ? Math.max(0, now - state.ts) : Infinity,
  };
}
