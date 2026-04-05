import { useState, useEffect, useCallback, useRef } from "react";
import { apiUrl, apiHeaders } from "../../services/piLocal";

const POLL_INTERVAL = 5000;
const MAX_EVENTS = 200;

/**
 * Aggregates wake word detection and task completion metrics.
 * Sources: /api/wake-debug (events), /api/timers, /api/llm/history
 */
export function usePerformanceMetrics(workerSettings) {
  const [wakeMetrics, setWakeMetrics] = useState(null);
  const [taskMetrics, setTaskMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const allEventsRef = useRef([]);
  const sinceRef = useRef(Date.now() - 24 * 60 * 60 * 1000); // last 24h

  const workerUrl = workerSettings?.url;
  const workerToken = workerSettings?.token;

  const computeWakeMetrics = useCallback((events) => {
    if (!events.length) return null;

    const now = Date.now();
    const last24h = events.filter((e) => now - e.timestamp < 24 * 60 * 60 * 1000);
    const lastHour = events.filter((e) => now - e.timestamp < 60 * 60 * 1000);

    // Detection events
    const detections = last24h.filter((e) => e.type === "wake_confirmed");
    const dnnScores = last24h.filter((e) => e.type === "dnn_score");
    const commands = last24h.filter((e) => e.type === "command");

    // DNN score distribution
    const scores = dnnScores.map((e) => e.data?.score || 0).filter((s) => s > 0);
    const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const highConfidence = scores.filter((s) => s >= 0.8).length;

    // Command breakdown
    const commandTypes = {};
    for (const c of commands) {
      const action = c.data?.action || c.data?.details || "unknown";
      commandTypes[action] = (commandTypes[action] || 0) + 1;
    }

    // Detections per hour (last 24h)
    const hourlyBuckets = Array(24).fill(0);
    for (const d of detections) {
      const h = new Date(d.timestamp).getHours();
      hourlyBuckets[h]++;
    }

    // RMS energy levels (noise floor indicator)
    const rmsValues = dnnScores.map((e) => e.data?.rms || 0).filter((r) => r > 0);
    const avgRms = rmsValues.length ? Math.round(rmsValues.reduce((a, b) => a + b, 0) / rmsValues.length) : 0;

    // False positive estimate: high DNN scores that didn't result in wake_confirmed
    // (within a 5s window after the score)
    let unconfirmedHighScores = 0;
    for (const s of dnnScores) {
      if ((s.data?.score || 0) >= 0.5) {
        const confirmed = detections.some(
          (d) => Math.abs(d.timestamp - s.timestamp) < 5000
        );
        if (!confirmed) unconfirmedHighScores++;
      }
    }

    return {
      detections24h: detections.length,
      detectionsLastHour: lastHour.filter((e) => e.type === "wake_confirmed").length,
      commands24h: commands.length,
      commandTypes,
      avgDnnScore: Math.round(avgScore * 1000) / 1000,
      highConfidenceRate: scores.length ? Math.round((highConfidence / scores.length) * 100) : 0,
      avgRmsEnergy: avgRms,
      hourlyDetections: hourlyBuckets,
      unconfirmedHighScores,
      totalDnnTriggers: scores.filter((s) => s >= 0.5).length,
      recentEvents: last24h.slice(-20).reverse(),
    };
  }, []);

  const computeTaskMetrics = useCallback((timers, llmHistory) => {
    const now = Date.now();

    // Timer metrics
    const activeTimers = timers.filter((t) => !t.dismissed && t.expiresAt > now);
    const completedTimers = timers.filter((t) => t.dismissed || t.expiresAt <= now);
    const voiceTimers = timers.filter((t) => t.source === "voice");
    const dashTimers = timers.filter((t) => t.source === "dashboard");

    // LLM query metrics
    const queries24h = llmHistory.filter(
      (q) => now - q.timestamp < 24 * 60 * 60 * 1000
    );
    const queryTypes = {};
    for (const q of queries24h) {
      const type = q.type || "general";
      queryTypes[type] = (queryTypes[type] || 0) + 1;
    }

    return {
      activeTimers: activeTimers.length,
      completedTimers: completedTimers.length,
      totalTimers: timers.length,
      voiceCreated: voiceTimers.length,
      dashboardCreated: dashTimers.length,
      llmQueries24h: queries24h.length,
      llmQueryTypes: queryTypes,
      recentQueries: queries24h.slice(-10).reverse(),
    };
  }, []);

  useEffect(() => {
    const headers = apiHeaders(workerToken);

    const poll = async () => {
      try {
        // Fetch wake debug events
        const wakeUrl = apiUrl(workerUrl, "/api/wake-debug");
        if (wakeUrl) {
          const res = await fetch(`${wakeUrl}?since=${sinceRef.current}`, { headers });
          if (res.ok) {
            const data = await res.json();
            if (data.events?.length) {
              const newEvents = data.events.filter(
                (e) => e.type !== "debug_hide" && e.type !== "debug_show"
              );
              allEventsRef.current = [...allEventsRef.current, ...newEvents]
                .slice(-MAX_EVENTS);
              const latest = data.events[data.events.length - 1];
              if (latest) sinceRef.current = latest.timestamp;
            }
          }
        }
        setWakeMetrics(computeWakeMetrics(allEventsRef.current));

        // Fetch timers + LLM history for task metrics
        let timers = [];
        let llmHistory = [];

        const timerUrl = apiUrl(workerUrl, "/api/timers");
        if (timerUrl) {
          const res = await fetch(timerUrl, { headers });
          if (res.ok) {
            const data = await res.json();
            timers = data.timers || [];
          }
        }

        if (workerUrl) {
          const res = await fetch(`${workerUrl}/api/llm/history`, { headers });
          if (res.ok) {
            const data = await res.json();
            llmHistory = data.history || [];
          }
        }

        setTaskMetrics(computeTaskMetrics(timers, llmHistory));
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [workerUrl, workerToken, computeWakeMetrics, computeTaskMetrics]);

  return { wakeMetrics, taskMetrics, loading };
}
