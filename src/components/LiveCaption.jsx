/**
 * Live STT caption bar — the designed version from the "Voice Transcription
 * Overlay" Pencil frame. Renders the Mac-mini voice-service's rolling
 * Whisper transcript in a backdrop-blurred pill at the bottom of the screen.
 *
 * Renders:
 *   - mic pulse badge on the left
 *   - the wake phrase highlighted in blue, command body in white
 *   - an action badge on the right ("→ Calendar", "→ TV On", etc.) when
 *     the transcript contains a recognizable command verb
 *   - a row of animated audio-level bars below the pill while active
 *
 * Visibility: fades in when a new transcript arrives, starts fading after
 * ~2s of silence, disappears entirely after ~5s.
 */

const WAKE_PHRASE_RE =
  /\b(hey|hi|hay|ok)\s+(ho(?:mer|mmer|mar|me[rl]|m'r)|homework|home\s*her|comni|jarvis|jervis)\b[,.\s!?:-]*/i;

const IDLE_FADE_AFTER_S = 2.0;
const HIDE_AFTER_S = 5.0;

// Map command body → action badge label + lucide icon. Mirrors the voice
// service's parse_command, kept intentionally loose — we just want a hint
// for the user about what the system *heard as a command*, regardless of
// whether dispatch succeeded.
function deriveAction(body) {
  const t = body.toLowerCase().trim();
  if (!t) return { label: "TV On", icon: "power" };
  if (/\bturn(ed|s)?\s*(it\s+)?(off|of|up|down|f)\b/.test(t)) return { label: "TV Off", icon: "power-off" };
  if (/\b(stop|dismiss|cancel|quiet)\b/.test(t)) return { label: "Stop", icon: "square" };
  if (/\bcalendar\b/.test(t)) return { label: "Calendar", icon: "calendar" };
  if (/\bweather\b/.test(t)) return { label: "Weather", icon: "cloud-sun" };
  if (/\b(photos?|pictures?|gallery)\b/.test(t)) return { label: "Photos", icon: "images" };
  if (/\b(go\s+(back|home)|back\s+to\s+(dashboard|home))\b/.test(t)) return { label: "Home", icon: "home" };
  if (/\btimer\b|\bremind me\b/.test(t)) return { label: "Timer", icon: "timer" };
  if (/\bturn(ed|s)?\s*(it\s+)?on\b/.test(t)) return { label: "TV On", icon: "power" };
  if (/\b(what|who|where|when|why|how|tell\s+me|explain)\b/.test(t) || t.split(/\s+/).length > 3) {
    return { label: "Ask", icon: "sparkles" };
  }
  return null;
}

// Tiny inline Lucide-style SVG icon set (no extra deps). Matches the
// stroke width + 24px viewBox Lucide conventions.
function MicIcon({ size = 28, color = "#FFFFFF" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function ArrowRightIcon({ size = 18, color = "#FFFFFF" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

// Animated audio level bars — ten bars that bob at different phases. When
// the caption is active the bars animate; when idle they flatten.
function LevelBars({ active }) {
  const bars = 10;
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        alignItems: "center",
        justifyContent: "center",
        height: 20,
      }}
    >
      {Array.from({ length: bars }, (_, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: active ? 6 : 2,
            background: i % 3 === 2 ? "#93C5FD" : "#60A5FA",
            borderRadius: 2,
            animation: active ? `cbar-${i} 1.1s ease-in-out ${i * 0.05}s infinite` : "none",
          }}
        />
      ))}
      <style>{`
        ${Array.from({ length: bars }, (_, i) => {
          const peak = 10 + Math.round(Math.sin(i * 1.37) * 4 + 6);
          return `@keyframes cbar-${i} {
            0%, 100% { height: 3px; }
            50%      { height: ${peak}px; }
          }`;
        }).join("\n")}
      `}</style>
    </div>
  );
}

export function LiveCaption({ text, isWake, age }) {
  if (!text || age > HIDE_AFTER_S) return null;

  const opacity = age < IDLE_FADE_AFTER_S
    ? 1
    : Math.max(0, 1 - (age - IDLE_FADE_AFTER_S) / (HIDE_AFTER_S - IDLE_FADE_AFTER_S));

  // Split the transcript around the wake phrase so we can style each chunk.
  const match = text.match(WAKE_PHRASE_RE);
  const pre = match ? text.slice(0, match.index).trim() : text.trim();
  const wakeHit = match ? match[0].trim().replace(/[,\s]+$/, "") : "";
  const body = match ? text.slice(match.index + match[0].length).trim() : "";

  const action = isWake && body ? deriveAction(body) : null;
  const active = age < IDLE_FADE_AFTER_S;

  return (
    <>
      <style>{`
        @keyframes capSlideIn {
          from { opacity: 0; transform: translate(-50%, 14px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes capMicHalo {
          0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.65); }
          50%      { box-shadow: 0 0 0 18px rgba(59,130,246,0.0); }
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          left: "50%",
          bottom: 44,
          transform: "translateX(-50%)",
          zIndex: 92,
          opacity,
          transition: "opacity 0.25s linear",
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          animation: "capSlideIn 0.28s ease-out",
          maxWidth: "82vw",
        }}
      >
        {/* The main pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            padding: "14px 22px",
            borderRadius: 999,
            background: "rgba(10, 15, 30, 0.82)",
            border: isWake
              ? "1.5px solid rgba(96,165,250,0.85)"
              : "1px solid rgba(255,255,255,0.16)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: isWake
              ? "0 0 40px rgba(59,130,246,0.45), 0 8px 24px rgba(0,0,0,0.5)"
              : "0 8px 24px rgba(0,0,0,0.45)",
            fontFamily: "'Geist','Inter',system-ui,sans-serif",
            color: "#F8FAFC",
            minWidth: 320,
          }}
        >
          {/* Mic badge */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: isWake
                ? "radial-gradient(circle at 30% 30%, #60A5FA 0%, #3B82F6 70%, #1E3A8A 100%)"
                : "rgba(59,130,246,0.2)",
              border: isWake ? "1.5px solid #93C5FD" : "1px solid rgba(255,255,255,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              animation: isWake ? "capMicHalo 1.4s ease-out infinite" : "none",
            }}
          >
            <MicIcon size={22} color="#FFFFFF" />
          </div>

          {/* Transcript: wake phrase highlighted, command body neutral */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 21,
              fontWeight: 500,
              letterSpacing: -0.2,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            {pre && <span style={{ color: "rgba(248,250,252,0.72)" }}>{pre}</span>}
            {wakeHit && (
              <span
                style={{
                  color: "#60A5FA",
                  fontWeight: 700,
                  textShadow: "0 0 12px rgba(96,165,250,0.65)",
                }}
              >
                {wakeHit}
                {match && /,\s*$/.test(match[0]) ? "," : ""}
              </span>
            )}
            {body && <span style={{ color: "#F8FAFC" }}>{body}</span>}
            {!match && !pre && (
              <span style={{ color: "rgba(248,250,252,0.8)" }}>{text}</span>
            )}
          </div>

          {/* Action badge — only when we can guess an action from the body */}
          {action && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 14px",
                borderRadius: 999,
                background: "#3B82F6",
                border: "1px solid rgba(147,197,253,0.8)",
                fontSize: 14,
                fontWeight: 600,
                color: "#FFFFFF",
                boxShadow: "0 0 18px rgba(59,130,246,0.55)",
                flexShrink: 0,
              }}
            >
              <ArrowRightIcon size={14} color="#FFFFFF" />
              {action.label}
            </div>
          )}
        </div>

        {/* Audio level bars — subtle, only when active + wake */}
        {isWake && active && <LevelBars active={active} />}
      </div>
    </>
  );
}
