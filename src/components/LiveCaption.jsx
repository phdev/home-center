/**
 * Bottom-screen live caption bar. Shows the Mac mini voice-service's
 * latest Whisper transcript. Fades out after a period of silence.
 * When the wake phrase is detected, the bar pulses and highlights the
 * matched prefix.
 */

const WAKE_PHRASE_RE = /\b(hey|hi|hay|ok)\s+(ho(mer|mmer|mar|me[rl]|m'r)|homework|home\s*her|comni|jarvis|jervis)\b[,.\s!?:-]*/i;

const IDLE_FADE_AFTER_S = 2.0;   // start fading after this long without updates
const HIDE_AFTER_S = 5.0;        // hide entirely after this

export function LiveCaption({ text, isWake, age }) {
  if (!text || age > HIDE_AFTER_S) return null;

  const opacity = age < IDLE_FADE_AFTER_S
    ? 1
    : Math.max(0, 1 - (age - IDLE_FADE_AFTER_S) / (HIDE_AFTER_S - IDLE_FADE_AFTER_S));

  // If the wake phrase is present, split so we can highlight it.
  const match = text.match(WAKE_PHRASE_RE);
  const pre = match ? text.slice(0, match.index) : text;
  const hit = match ? match[0] : "";
  const post = match ? text.slice(match.index + match[0].length) : "";

  return (
    <>
      <style>{`
        @keyframes captionSlideIn {
          from { opacity: 0; transform: translate(-50%, 12px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes captionPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.7); }
          50%      { box-shadow: 0 0 0 14px rgba(59,130,246,0); }
        }
      `}</style>
      <div
        style={{
          position: "fixed",
          left: "50%",
          bottom: 44,
          transform: "translateX(-50%)",
          zIndex: 90,
          maxWidth: "75vw",
          padding: "12px 22px",
          borderRadius: 999,
          background: isWake ? "rgba(59,130,246,0.18)" : "rgba(0,0,0,0.72)",
          border: isWake ? "1px solid rgba(59,130,246,0.65)" : "1px solid rgba(255,255,255,0.14)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          color: "#fff",
          fontFamily: "'Geist','Inter',system-ui,sans-serif",
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: 0.2,
          lineHeight: 1.35,
          textAlign: "center",
          opacity,
          transition: "opacity 0.25s linear, background 0.2s ease-out",
          animation: isWake
            ? "captionSlideIn 0.2s ease-out, captionPulse 1.4s ease-out 1"
            : "captionSlideIn 0.2s ease-out",
          pointerEvents: "none",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {pre && <span style={{ opacity: 0.82 }}>{pre}</span>}
        {hit && (
          <span
            style={{
              color: "#60A5FA",
              fontWeight: 700,
              textShadow: "0 0 10px rgba(96,165,250,0.6)",
            }}
          >
            {hit}
          </span>
        )}
        {post && <span>{post}</span>}
        {!match && !pre && <span style={{ opacity: 0.82 }}>{text}</span>}
      </div>
    </>
  );
}
