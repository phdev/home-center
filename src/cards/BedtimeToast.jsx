import { Moon, X } from "lucide-react";
import { useSettings } from "../hooks/useSettings";

const F = "'Geist','Inter',system-ui,sans-serif";

/**
 * Floating toast — positioned fixed bottom-right. Rendered inside an
 * overlay container in App.jsx (or wherever the overlay slot lives).
 *
 * Dismiss / snooze write to `settings.bedtimeDismissedUntil` so the
 * deterministic derivation in `computeBedtime` suppresses the flag.
 */
export function BedtimeToast({ derived, enhanced = {} }) {
  const { updateSettings } = useSettings();
  const w = derived.bedtimeWindow;
  if (!w) return null;

  const bedtime = new Date(w.bedtimeAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const kidsLabel = w.kidsInRange.map((k) => k.childName).join(" & ");
  const copy =
    enhanced.copy ??
    `Winding down in ${w.minutesUntil} min — ${kidsLabel} bedtime at ${bedtime}.`;

  const snooze = () => {
    const until = new Date(Date.now() + 10 * 60000).toISOString();
    updateSettings({ bedtimeDismissedUntil: until });
  };
  const start = () => {
    const until = new Date(w.bedtimeAt).toISOString();
    updateSettings({ bedtimeDismissedUntil: until });
  };

  return (
    <div style={wrapStyle}>
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={iconBgStyle}>
            <Moon size={18} color="#C4B5FD" />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: F,
                fontSize: 16,
                fontWeight: 600,
                color: "#FFFFFF",
              }}
            >
              Winding down in {w.minutesUntil} min
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono',ui-monospace,monospace",
                fontSize: 11,
                color: "#C4B5FDCC",
              }}
            >
              Bedtime {bedtime} · {kidsLabel}
            </div>
          </div>
          <button onClick={snooze} style={closeStyle} aria-label="Snooze">
            <X size={16} color="#FFFFFF88" />
          </button>
        </div>
        <p style={bodyStyle}>{copy}</p>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button onClick={snooze} style={secondaryBtn}>
            Snooze 10 min
          </button>
          <button onClick={start} style={primaryBtn}>
            Start bedtime
          </button>
        </div>
      </div>
    </div>
  );
}

const wrapStyle = {
  position: "fixed",
  bottom: 24,
  right: 24,
  zIndex: 90,
  pointerEvents: "auto",
};

const cardStyle = {
  width: 380,
  padding: "14px 16px",
  borderRadius: 16,
  background: "#1E1B4B",
  border: "1px solid #8B5CF680",
  boxShadow: "0 12px 40px rgba(139, 92, 246, 0.25)",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const iconBgStyle = {
  width: 36,
  height: 36,
  borderRadius: 999,
  background: "#8B5CF625",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const closeStyle = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: 4,
};

const bodyStyle = {
  margin: 0,
  fontFamily: F,
  fontSize: 13,
  color: "#E0E7FF",
  lineHeight: 1.45,
};

const secondaryBtn = {
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid #C4B5FD60",
  background: "transparent",
  color: "#C4B5FD",
  fontFamily: F,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const primaryBtn = {
  padding: "6px 12px",
  borderRadius: 999,
  border: "none",
  background: "#8B5CF6",
  color: "#FFFFFF",
  fontFamily: F,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
