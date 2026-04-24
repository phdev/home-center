/**
 * Full-screen Siri-style glowing border that pulses on when the voice-service
 * flags an active wake ("Hey Homer" confirmed by Whisper). It sits on top of
 * everything else and fades out a couple seconds after idle.
 *
 * Visual: thick inset glow around the viewport, animated gradient sweep that
 * rotates through blue/indigo/cyan — matches the Apple Intelligence / Siri
 * "listening" ornament vibe.
 */

const ACTIVE_AFTER_S = 0.0;     // show immediately on wake
const FADE_AFTER_S = 3.5;       // start fading after this many seconds idle
const HIDE_AFTER_S = 5.0;       // fully gone after this

export function WakeOverlay({ isWake, age }) {
  // "active" state is: wake phrase detected AND the transcript is recent.
  if (!isWake || age > HIDE_AFTER_S) return null;

  const opacity = age < FADE_AFTER_S
    ? 1
    : Math.max(0, 1 - (age - FADE_AFTER_S) / (HIDE_AFTER_S - FADE_AFTER_S));

  return (
    <>
      <style>{`
        @keyframes wakeSpin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes wakePulse {
          0%, 100% { opacity: 0.85; }
          50%      { opacity: 1.0; }
        }
        @keyframes wakeEnter {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      {/*
        Three stacked layers so the glow reads as "thick, animated, premium":
          1. background-sweeping conic gradient (rotates)
          2. a brighter inner ring (pulses)
          3. a soft vignette to keep dashboard contrast
      */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 95,
          pointerEvents: "none",
          opacity,
          animation: "wakeEnter 0.35s ease-out, wakePulse 2.1s ease-in-out infinite",
          transition: "opacity 0.25s linear",
        }}
      >
        {/* Rotating conic gradient border */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 0,
            background: `conic-gradient(
              from 0deg,
              rgba(59,130,246,0.0) 0%,
              rgba(59,130,246,0.55) 12%,
              rgba(99,102,241,0.65) 25%,
              rgba(34,211,238,0.55) 50%,
              rgba(99,102,241,0.65) 75%,
              rgba(59,130,246,0.55) 88%,
              rgba(59,130,246,0.0) 100%
            )`,
            maskImage: `radial-gradient(circle at center,
              transparent 55%, black 85%)`,
            WebkitMaskImage: `radial-gradient(circle at center,
              transparent 55%, black 85%)`,
            animation: "wakeSpin 6s linear infinite",
            filter: "blur(22px) saturate(1.4)",
          }}
        />

        {/* Sharp inner ring — defines the actual border line */}
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
