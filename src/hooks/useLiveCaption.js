import { useEffect, useState } from "react";
import { apiHeaders, apiUrl } from "../services/piLocal";

let lastCompletedCaptionKey = "";

function captionKey(data, stage) {
  return `${data.ts || 0}:${stage}:${data.text || ""}`;
}

export function useLiveCaption(workerSettings, { pollMs = 200 } = {}) {
  const [state, setState] = useState({ text: "", isWake: false, stage: "", ts: 0 });

  const workerUrl = workerSettings?.url;
  const workerToken = workerSettings?.token;

  useEffect(() => {
    const url = apiUrl(workerUrl, "/api/transcription");
    if (!url) return undefined;
    let active = true;

    const poll = async () => {
      try {
        const res = await fetch(url, { headers: apiHeaders(workerToken), cache: "no-store" });
        if (!res.ok || !active) return;
        const data = await res.json();
        if (!data || typeof data.text !== "string") return;
        const stage = typeof data.stage === "string" ? data.stage : "";
        const isWake = !!data.is_wake;
        const activeStage = stage === "listening" || stage === "verifying";
        const key = captionKey(data, stage);
        const nextText = activeStage ? "" : data.text;
        if (!activeStage && data.text && key === lastCompletedCaptionKey) {
          setState((prev) => (
            prev.text || prev.stage ? { text: "", isWake: false, stage: "", ts: 0 } : prev
          ));
          return;
        }
        if (!activeStage && data.text) {
          lastCompletedCaptionKey = key;
        }
        setState((prev) => {
          const nextTs = activeStage ? (prev.ts || data.ts || 0) : data.ts || 0;
          return prev.ts === nextTs && prev.text === nextText && prev.stage === stage && prev.isWake === isWake
            ? prev
            : { text: nextText, isWake, stage, ts: nextTs };
        });
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

  return {
    text: state.text,
    isWake: state.isWake,
    stage: state.stage,
    ts: state.ts,
    age: state.ts ? Math.max(0, Date.now() / 1000 - state.ts) : Infinity,
  };
}
