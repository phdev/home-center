import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Polls the worker for LLM query responses (from voice/Pi).
 * Returns the latest response, history, and control functions.
 */
export function useLLMQuery(workerSettings) {
  const [latestResponse, setLatestResponse] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const lastTimestampRef = useRef(0);

  const workerUrl = workerSettings?.url;
  const workerToken = workerSettings?.token;

  // Poll for latest LLM response every 2s
  useEffect(() => {
    if (!workerUrl) return;

    const poll = async () => {
      try {
        const headers = {};
        if (workerToken) headers.Authorization = `Bearer ${workerToken}`;
        const res = await fetch(`${workerUrl}/api/llm/latest`, { headers });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.response) {
          // Latest was dismissed — clear it locally too
          if (latestResponse) setLatestResponse(null);
          return;
        }
        if (data.response.timestamp <= lastTimestampRef.current) return;
        lastTimestampRef.current = data.response.timestamp;
        setLatestResponse(data.response);
      } catch {
        // silent
      }
    };

    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [workerUrl, workerToken, latestResponse]);

  // Fetch history on demand
  const fetchHistory = useCallback(async () => {
    if (!workerUrl) return;
    setHistoryLoading(true);
    try {
      const headers = {};
      if (workerToken) headers.Authorization = `Bearer ${workerToken}`;
      const res = await fetch(`${workerUrl}/api/llm/history`, { headers });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch {
      // silent
    } finally {
      setHistoryLoading(false);
    }
  }, [workerUrl, workerToken]);

  // Dismiss the latest response
  const dismissResponse = useCallback(async () => {
    setLatestResponse(null);
    if (!workerUrl) return;
    try {
      const headers = { "Content-Type": "application/json" };
      if (workerToken) headers.Authorization = `Bearer ${workerToken}`;
      await fetch(`${workerUrl}/api/llm/dismiss`, {
        method: "POST",
        headers,
        body: "{}",
      });
    } catch {
      // silent
    }
  }, [workerUrl, workerToken]);

  return {
    latestResponse,
    history,
    historyLoading,
    fetchHistory,
    dismissResponse,
  };
}
