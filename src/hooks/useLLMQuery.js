import { useState, useEffect, useCallback, useRef } from "react";
import { rememberKnowledgeResponse } from "../knowledge/feedback";
import { apiHeaders, apiUrl } from "../services/piLocal";

/**
 * Polls the worker for LLM query responses (from voice/Pi).
 * Returns the latest response, history, and control functions.
 */
export function useLLMQuery(workerSettings) {
  const [latestResponse, setLatestResponse] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const lastResponseVersionRef = useRef(0);

  const workerUrl = workerSettings?.url;
  const workerToken = workerSettings?.token;

  // Poll for latest LLM response every 2s
  useEffect(() => {
    if (!workerUrl) return;

    const poll = async () => {
      try {
        const url = apiUrl(workerUrl, "/api/llm/latest");
        const res = await fetch(url, { headers: apiHeaders(workerToken) });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.response) {
          // Latest was dismissed — clear it locally too
          if (latestResponse) setLatestResponse(null);
          return;
        }
        const responseVersion = Number(data.response.updatedAt || data.response.timestamp || 0);
        if (responseVersion <= lastResponseVersionRef.current) return;
        lastResponseVersionRef.current = responseVersion;
        rememberKnowledgeResponse(data.response);
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
      const url = apiUrl(workerUrl, "/api/llm/history");
      const res = await fetch(url, { headers: apiHeaders(workerToken) });
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
      const url = apiUrl(workerUrl, "/api/llm/dismiss");
      await fetch(url, {
        method: "POST",
        headers: apiHeaders(workerToken),
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
