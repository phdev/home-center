import { useEffect, useState } from "react";

/**
 * Siri-like animated blue gradient border overlay shown when wake word is detected.
 * Renders a full-screen border that pulses with a rotating gradient.
 */
export function VoiceActivationOverlay({ active }) {
  const [visible, setVisible] = useState(false);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (active) {
      setVisible(true);
      // Fade in
      requestAnimationFrame(() => setOpacity(1));
    } else {
      // Fade out
      setOpacity(0);
      const t = setTimeout(() => setVisible(false), 500);
      return () => clearTimeout(t);
    }
  }, [active]);

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes voice-border-rotate {
          0% { --voice-angle: 0deg; }
          100% { --voice-angle: 360deg; }
        }
        @keyframes voice-border-pulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @property --voice-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
      `}</style>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10000,
          pointerEvents: "none",
          opacity,
          transition: "opacity 0.4s ease-in-out",
        }}
      >
        {/* Outer glow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 0,
            boxShadow: "inset 0 0 60px 15px rgba(59, 130, 246, 0.3), inset 0 0 120px 30px rgba(99, 102, 241, 0.15)",
            animation: "voice-border-pulse 1.5s ease-in-out infinite",
          }}
        />
        {/* Top border gradient */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "linear-gradient(90deg, transparent, #3B82F6, #818CF8, #6366F1, #3B82F6, transparent)",
            animation: "voice-border-pulse 1.5s ease-in-out infinite",
          }}
        />
        {/* Bottom border gradient */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "linear-gradient(90deg, transparent, #6366F1, #3B82F6, #818CF8, #6366F1, transparent)",
            animation: "voice-border-pulse 1.5s ease-in-out infinite",
          }}
        />
        {/* Left border gradient */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: 4,
            background: "linear-gradient(180deg, transparent, #3B82F6, #818CF8, #6366F1, #3B82F6, transparent)",
            animation: "voice-border-pulse 1.5s ease-in-out infinite",
          }}
        />
        {/* Right border gradient */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            right: 0,
            width: 4,
            background: "linear-gradient(180deg, transparent, #6366F1, #3B82F6, #818CF8, #6366F1, transparent)",
            animation: "voice-border-pulse 1.5s ease-in-out infinite",
          }}
        />
        {/* Corner glows */}
        {[
          { top: -10, left: -10 },
          { top: -10, right: -10 },
          { bottom: -10, left: -10 },
          { bottom: -10, right: -10 },
        ].map((pos, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              ...pos,
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(99, 102, 241, 0.5), transparent 70%)",
              animation: "voice-border-pulse 1.5s ease-in-out infinite",
            }}
          />
        ))}
      </div>
    </>
  );
}
