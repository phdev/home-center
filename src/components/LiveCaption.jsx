import {
  ArrowRight,
  Calendar,
  CloudSun,
  Home,
  Images,
  Mic,
  Power,
  PowerOff,
  Sparkles,
  Square,
  Timer,
} from "lucide-react";

const WAKE_PHRASE_RE =
  /\b(hey|hi|hay|okay|ok)\s+(ho(?:mer|mmer|mar|me[rl]|m'r)|home\s*her|homework|homer)\b[,.\s!?:-]*/i;

const IDLE_FADE_AFTER_S = 2.0;
const HIDE_AFTER_S = 5.0;

function deriveAction(body) {
  const text = body.toLowerCase().trim();
  if (!text) return null;
  if (/\bturn(ed|s)?\s*(it\s+)?(off|of|up|down|f)\b/.test(text)) return { label: "TV Off", Icon: PowerOff };
  if (/\b(stop|dismiss|cancel|quiet)\b/.test(text)) return { label: "Stop", Icon: Square };
  if (/\bcalendar\b/.test(text)) return { label: "Calendar", Icon: Calendar };
  if (/\bweather\b/.test(text)) return { label: "Weather", Icon: CloudSun };
  if (/\b(photos?|pictures?|gallery)\b/.test(text)) return { label: "Photos", Icon: Images };
  if (/\b(go\s+(back|home)|back\s+to\s+(dashboard|home))\b/.test(text)) return { label: "Home", Icon: Home };
  if (/\btimer\b|\bremind me\b/.test(text)) return { label: "Timer", Icon: Timer };
  if (/\bturn(ed|s)?\s*(it\s+)?on\b/.test(text)) return { label: "TV On", Icon: Power };
  if (/\b(what|who|where|when|why|how|tell\s+me|explain|describe)\b/.test(text) || text.split(/\s+/).length > 4) {
    return { label: "Ask", Icon: Sparkles };
  }
  return null;
}

function LevelBars({ active }) {
  const bars = [7, 14, 20, 16, 10, 18, 14, 9, 12, 7];
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "center", height: 22 }}>
      {bars.map((height, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: active ? height : 3,
            borderRadius: 3,
            background: i % 3 === 2 ? "#93C5FD" : "#60A5FA",
            animation: active ? `captionBar${i} 1.1s ease-in-out ${i * 0.05}s infinite` : "none",
          }}
        />
      ))}
      <style>{bars.map((height, i) => `
        @keyframes captionBar${i} {
          0%, 100% { height: 3px; }
          50% { height: ${height}px; }
        }
      `).join("\n")}</style>
    </div>
  );
}

export function LiveCaption({ text, isWake, age }) {
  if (!text || age > HIDE_AFTER_S) return null;

  const opacity = age < IDLE_FADE_AFTER_S
    ? 1
    : Math.max(0, 1 - (age - IDLE_FADE_AFTER_S) / (HIDE_AFTER_S - IDLE_FADE_AFTER_S));

  const match = text.match(WAKE_PHRASE_RE);
  const beforeWake = match ? text.slice(0, match.index).trim() : text.trim();
  const wakePart = match ? match[0].trim().replace(/[,\s]+$/, "") : "";
  const body = match ? text.slice(match.index + match[0].length).trim() : "";
  const action = isWake ? deriveAction(body) : null;
  const active = age < IDLE_FADE_AFTER_S;
  const ActionIcon = action?.Icon;

  return (
    <>
      <style>{`
        @keyframes captionIn {
          from { opacity: 0; transform: translate(-50%, 14px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes captionMicHalo {
          0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.65); }
          50% { box-shadow: 0 0 0 18px rgba(59,130,246,0); }
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
          animation: "captionIn 0.28s ease-out",
          maxWidth: "82vw",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            padding: "14px 22px",
            borderRadius: 999,
            background: "rgba(10, 15, 30, 0.9)",
            border: isWake ? "1.5px solid rgba(96,165,250,0.85)" : "1px solid rgba(255,255,255,0.16)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: isWake
              ? "0 0 40px rgba(59,130,246,0.45), 0 8px 24px rgba(0,0,0,0.5)"
              : "0 8px 24px rgba(0,0,0,0.45)",
            fontFamily: "'Geist','Inter',system-ui,sans-serif",
            color: "#F8FAFC",
            minWidth: 320,
            maxWidth: "100%",
          }}
        >
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
              animation: isWake ? "captionMicHalo 1.4s ease-out infinite" : "none",
            }}
          >
            <Mic size={22} color="#FFFFFF" strokeWidth={2.2} />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 21,
              fontWeight: 500,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            {beforeWake && <span style={{ color: "rgba(248,250,252,0.72)" }}>{beforeWake}</span>}
            {wakePart && (
              <span style={{ color: "#60A5FA", fontWeight: 700, textShadow: "0 0 12px rgba(96,165,250,0.65)" }}>
                {wakePart}
                {match && /,\s*$/.test(match[0]) ? "," : ""}
              </span>
            )}
            {body && <span style={{ color: "#F8FAFC" }}>{body}</span>}
          </div>

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
              {ActionIcon ? <ActionIcon size={14} color="#FFFFFF" strokeWidth={2.4} /> : <ArrowRight size={14} />}
              {action.label}
            </div>
          )}
        </div>
        {isWake && active && <LevelBars active={active} />}
      </div>
    </>
  );
}
