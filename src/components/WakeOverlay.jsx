const FADE_AFTER_S = 3.5;
const HIDE_AFTER_S = 5.0;

export function WakeOverlay({ isWake, age }) {
  if (!isWake || age > HIDE_AFTER_S) return null;

  const opacity = age < FADE_AFTER_S
    ? 1
    : Math.max(0, 1 - (age - FADE_AFTER_S) / (HIDE_AFTER_S - FADE_AFTER_S));

  return (
    <>
      <style>{`
        @keyframes wakeSpin { to { transform: rotate(360deg); } }
        @keyframes wakePulse {
          0%, 100% { opacity: 0.86; }
          50% { opacity: 1; }
        }
      `}</style>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 95,
          pointerEvents: "none",
          opacity,
          transition: "opacity 0.25s linear",
          animation: "wakePulse 2.1s ease-in-out infinite",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `conic-gradient(
              from 0deg,
              rgba(59,130,246,0) 0%,
              rgba(59,130,246,0.55) 12%,
              rgba(99,102,241,0.65) 25%,
              rgba(34,211,238,0.55) 50%,
              rgba(99,102,241,0.65) 75%,
              rgba(59,130,246,0.55) 88%,
              rgba(59,130,246,0) 100%
            )`,
            filter: "blur(22px) saturate(1.4)",
            maskImage: "radial-gradient(circle at center, transparent 55%, black 85%)",
            WebkitMaskImage: "radial-gradient(circle at center, transparent 55%, black 85%)",
            animation: "wakeSpin 6s linear infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 8,
            borderRadius: 18,
            boxShadow: `
              inset 0 0 0 2px rgba(96,165,250,0.85),
              inset 0 0 40px 6px rgba(59,130,246,0.45),
              0 0 30px 2px rgba(59,130,246,0.35)
            `,
          }}
        />
      </div>
    </>
  );
}
