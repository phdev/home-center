import { useEffect, useState } from "react";
import { apiHeaders, apiUrl } from "../services/piLocal";

export function useLiveCaption(workerSettings, { pollMs = 150 } = {}) {
  const [state, setState] = useState({ text: "", isWake: false, ts: 0 });
  const [now, setNow] = useState(() => Date.now() / 1000);

  const workerUrl = workerSettings?.url;
  const workerToken = workerSettings?.token;

  useEffect(() => {
    const url = apiUrl(workerUrl, "/api/transcription");
    if (!url) return undefined;
    let active = true;

    const poll = async () => {
      try {
        const res = await fetch(url, { headers: apiHeaders(workerToken) });
        if (!res.ok || !active) return;
        const data = await res.json();
        if (!data || typeof data.text !== "string") return;
        setState((prev) => (
          prev.ts === data.ts && prev.text === data.text
            ? prev
            : { text: data.text, isWake: !!data.is_wake, ts: data.ts || 0 }
        ));
      } catch {
        // Pi may be offline during development.
      }
    };

    poll();
    const id = setInterval(poll, pollMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [workerUrl, workerToken, pollMs]);

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
