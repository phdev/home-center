import { useState, useEffect, useCallback } from "react";
import { apiUrl, apiHeaders } from "../services/piLocal";

/**
 * Polls /api/tasks for OpenClaw agent tasks.
 * Falls back to mock data when no worker is configured.
 */
export function useAgentTasks(workerSettings) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const workerUrl = workerSettings?.url;
  const workerToken = workerSettings?.token;

  const poll = useCallback(async () => {
    const url = apiUrl(workerUrl, "/api/tasks");
    if (!url) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(url, { headers: apiHeaders(workerToken) });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [workerUrl, workerToken]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [poll]);

  const addTask = useCallback(
    async (title, detail, source) => {
      const url = apiUrl(workerUrl, "/api/tasks");
      if (!url) return;
      try {
        await fetch(url, {
          method: "POST",
          headers: apiHeaders(workerToken),
          body: JSON.stringify({ title, detail, source }),
        });
        poll();
      } catch {
        // silent
      }
    },
    [workerUrl, workerToken, poll],
  );

  const completeTask = useCallback(
    async (id) => {
      const url = apiUrl(workerUrl, `/api/tasks/${encodeURIComponent(id)}/complete`);
      if (!url) return;
      try {
        await fetch(url, {
          method: "POST",
          headers: apiHeaders(workerToken),
        });
        poll();
      } catch {
        // silent
      }
    },
    [workerUrl, workerToken, poll],
  );

  const deleteTask = useCallback(
    async (id) => {
      const url = apiUrl(workerUrl, `/api/tasks/${encodeURIComponent(id)}`);
      if (!url) return;
      try {
        await fetch(url, {
          method: "DELETE",
          headers: apiHeaders(workerToken),
        });
        poll();
      } catch {
        // silent
      }
    },
    [workerUrl, workerToken, poll],
  );

  const activeTasks = tasks.filter((t) => t.status === "active");
  const completedTasks = tasks.filter((t) => t.status === "done");

  return {
    tasks,
    activeTasks,
    completedTasks,
    loading,
    addTask,
    completeTask,
    deleteTask,
    refresh: poll,
  };
}
