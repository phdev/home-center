import { useEffect, useMemo, useState } from "react";

const POLL_MS = 10_000;

export function useOpenClawThread(openclawSettings = {}) {
  const [state, setState] = useState({ messages: [], status: "idle" });
  const url = openclawSettings.url?.replace(/\/+$/, "");
  const chatId = openclawSettings.chatId?.trim();

  const endpoint = useMemo(() => {
    if (!url) return "";
    const params = new URLSearchParams({ limit: "6" });
    if (chatId) params.set("chatId", chatId);
    return `${url}/thread?${params.toString()}`;
  }, [url, chatId]);

  useEffect(() => {
    if (!endpoint) {
      setState({ messages: [], status: "unconfigured" });
      return;
    }

    let cancelled = false;
    const fetchThread = async () => {
      try {
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setState({
            messages: Array.isArray(data.messages) ? data.messages : [],
            status: data.ready ? "connected" : "starting",
          });
        }
      } catch {
        if (!cancelled) setState((prev) => ({ ...prev, status: "offline" }));
      }
    };

    fetchThread();
    const timer = setInterval(fetchThread, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [endpoint]);

  return state;
}
