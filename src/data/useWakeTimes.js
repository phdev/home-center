import { useCallback, useEffect, useState } from "react";
import { readWithFallback, writeWithFallback } from "./_storage";

const LOCAL_KEY = "hc:wake-times";
const POLL_MS = 15 * 1000;

export function useWakeTimes(workerSettings) {
  const [wakeTimes, setWakeTimes] = useState(() => readLocal());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const data = await readWithFallback({
        workerSettings,
        path: "/api/wake-times/today",
        readLocal,
        writeLocal,
        parse: (d) => (d && typeof d === "object" && d.date === todayKey() ? d : null),
      });
      if (!cancelled) setWakeTimes(data);
    };
    load();
    const interval = setInterval(load, POLL_MS);
    const handler = (e) => setWakeTimes(e.detail);
    window.addEventListener("hc:wake-times-updated", handler);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("hc:wake-times-updated", handler);
    };
  }, [workerSettings?.url, workerSettings?.token]);

  return wakeTimes;
}

export function useWakeTimeWriter(workerSettings) {
  return useCallback(
    async ({ childId, childName, time }) => {
      if (!childId || !time) throw new Error("Child and wake time are required.");
      const date = todayKey();
      const prev = readLocal() ?? { date, children: {} };
      const wakeAt = `${date}T${time}:00`;
      const next = {
        ...prev,
        date,
        children: {
          ...(prev.children ?? {}),
          [childId]: {
            childId,
            childName,
            wakeAt,
            source: "mobile",
            updatedAt: new Date().toISOString(),
          },
        },
        updatedAt: new Date().toISOString(),
      };
      const result = await writeWithFallback({
        workerSettings,
        path: "/api/wake-times/today",
        method: "POST",
        body: {
          date,
          source: "mobile",
          children: {
            [childId]: { wakeAt },
          },
        },
        writeLocalOnFailure: () => writeLocal(next),
        writeLocalOnSuccess: () => writeLocal(next),
      });
      const saved = result.data && typeof result.data === "object" ? result.data : next;
      writeLocal(saved);
      window.dispatchEvent(new CustomEvent("hc:wake-times-updated", { detail: saved }));
      return saved;
    },
    [workerSettings?.url, workerSettings?.token],
  );
}

function todayKey() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function readLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.date !== todayKey()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocal(d) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(d));
  } catch {}
}
