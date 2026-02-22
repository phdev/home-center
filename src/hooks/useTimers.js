import { useState, useEffect } from "react";

let _timerId = 0;

export function useTimers() {
  const [timers, setTimers] = useState([]);

  useEffect(() => {
    const id = setInterval(() => {
      setTimers((prev) =>
        prev.map((t) => {
          if (t.paused || t.remaining <= 0) return t;
          const next = t.remaining - 1;
          if (next <= 0 && !t.alerted) {
            // Play alert sound
            try {
              const ac = new (window.AudioContext ||
                window.webkitAudioContext)();
              const playBeep = (freq, time) => {
                const osc = ac.createOscillator();
                const gain = ac.createGain();
                osc.connect(gain);
                gain.connect(ac.destination);
                osc.frequency.value = freq;
                osc.type = "sine";
                gain.gain.setValueAtTime(0.3, ac.currentTime + time);
                gain.gain.exponentialRampToValueAtTime(
                  0.001,
                  ac.currentTime + time + 0.3,
                );
                osc.start(ac.currentTime + time);
                osc.stop(ac.currentTime + time + 0.3);
              };
              playBeep(880, 0);
              playBeep(880, 0.4);
              playBeep(1100, 0.8);
            } catch (e) {
              // ignore
            }
            return { ...t, remaining: 0, alerted: true };
          }
          return { ...t, remaining: next };
        }),
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const addTimer = (name, seconds) => {
    setTimers((prev) => [
      ...prev,
      {
        id: ++_timerId,
        name,
        total: seconds,
        remaining: seconds,
        paused: false,
        alerted: false,
        created: Date.now(),
      },
    ]);
  };

  const togglePause = (id) => {
    setTimers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, paused: !t.paused } : t)),
    );
  };

  const removeTimer = (id) => {
    setTimers((prev) => prev.filter((t) => t.id !== id));
  };

  const resetTimer = (id) => {
    setTimers((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, remaining: t.total, paused: false, alerted: false }
          : t,
      ),
    );
  };

  const dismissAlert = (id) => {
    setTimers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, alerted: false } : t)),
    );
  };

  return { timers, addTimer, togglePause, removeTimer, resetTimer, dismissAlert };
}
