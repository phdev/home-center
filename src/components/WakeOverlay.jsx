const HIDE_AFTER_S = 5.0;

export function WakeOverlay({ isWake, ts }) {
  if (!isWake) return null;

  return (
    <>
      <style>{`
        @keyframes wakeLifetime {
          0%, 70% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
      <div
        key={ts}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 95,
          pointerEvents: "none",
          animation: `wakeLifetime ${HIDE_AFTER_S}s linear forwards`,
          transform: "translateZ(0)",
          willChange: "opacity",
          contain: "paint",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `
              radial-gradient(circle at 50% 50%, rgba(59,130,246,0) 58%, rgba(59,130,246,0.18) 76%, rgba(37,99,235,0.32) 100%),
              linear-gradient(90deg, rgba(59,130,246,0.42), rgba(96,165,250,0.16) 18%, rgba(59,130,246,0) 34%, rgba(59,130,246,0) 66%, rgba(96,165,250,0.16) 82%, rgba(59,130,246,0.42)),
              linear-gradient(180deg, rgba(59,130,246,0.42), rgba(96,165,250,0.14) 20%, rgba(59,130,246,0) 36%, rgba(59,130,246,0) 64%, rgba(96,165,250,0.14) 80%, rgba(59,130,246,0.42))
            `,
            filter: "blur(18px) saturate(1.25)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 8,
            borderRadius: 18,
            boxShadow: `
              inset 0 0 0 1.5px rgba(96,165,250,0.68),
              inset 0 0 34px 5px rgba(59,130,246,0.34),
              0 0 24px 1px rgba(59,130,246,0.26)
            `,
          }}
        />
      </div>
    </>
  );
}
