import { useEffect, useRef } from "react";

export function AlarmOverlay({ expiredTimers, onDismissAll }) {
  const audioRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (expiredTimers.length === 0) {
      // Stop alarm
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.close();
        audioRef.current = null;
      }
      return;
    }

    // Start alarm loop
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioRef.current = ctx;

    function playAlarmCycle() {
      if (ctx.state === "closed") return;
      const now = ctx.currentTime;
      // Two-tone alarm: 880Hz then 660Hz, square wave
      for (let i = 0; i < 4; i++) {
        const freq = i % 2 === 0 ? 880 : 660;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "square";
        osc.frequency.value = freq;
        const start = now + i * 0.3;
        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
        osc.start(start);
        osc.stop(start + 0.3);
      }
    }

    playAlarmCycle();
    intervalRef.current = setInterval(playAlarmCycle, 1200);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      ctx.close();
      audioRef.current = null;
    };
  }, [expiredTimers.length > 0]);

  if (expiredTimers.length === 0) return null;

  const names = expiredTimers.map((t) => t.name).join(", ");

  return (
    <div
      onClick={onDismissAll}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(0,0,0,0.88)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        fontFamily: "'Geist','Inter',system-ui,sans-serif",
      }}
    >
      <div
        style={{
          fontSize: 80,
          animation: "alarm-pulse 1s ease-in-out infinite",
        }}
      >
        🔔
      </div>
      <div
        style={{
          fontSize: 42,
          fontWeight: 700,
          color: "#FF6B6B",
          marginTop: 24,
          textAlign: "center",
          padding: "0 40px",
        }}
      >
        {names}
      </div>
      <div
        style={{
          fontSize: 28,
          color: "#FFFFFF",
          marginTop: 16,
          fontWeight: 600,
        }}
      >
        Timer Done!
      </div>
      <div
        style={{
          fontSize: 18,
          color: "#FFFFFF80",
          marginTop: 32,
        }}
      >
        Say &quot;Hey Homer, stop&quot; or tap anywhere to dismiss
      </div>

      <style>{`
        @keyframes alarm-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
