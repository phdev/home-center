import { useEffect, useState } from "react";
import { readWithFallback } from "./_storage";

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
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [workerSettings?.url, workerSettings?.token]);

  return wakeTimes;
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
