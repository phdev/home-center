import { formatTime } from "../utils/formatTime";

export function TimerStrip({ t, timers, onTabSwitch }) {
  const active = timers.filter((tm) => tm.remaining > 0 || tm.alerted);
  if (active.length === 0) return null;

  return (
    <div
      onClick={onTabSwitch}
      style={{ display: "flex", gap: 8, cursor: "pointer" }}
    >
      {active.slice(0, 3).map((tm) => {
        const pct = tm.total > 0 ? (tm.remaining / tm.total) * 100 : 0;
        const urgent = tm.remaining > 0 && tm.remaining <= 60;
        const done = tm.remaining <= 0;
        return (
          <div
            key={tm.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: t.radius / 2,
              background: done ? `${t.warm}20` : `${t.accent}10`,
              border: `1px solid ${done ? t.warm + "30" : t.accent + "20"}`,
              animation: done
                ? "timerPulse 1s ease infinite"
                : urgent
                  ? "timerPulse 2s ease infinite"
                  : "none",
            }}
          >
            <span style={{ fontSize: "0.75rem" }}>
              {done ? "\u{1F514}" : "\u23F1\uFE0F"}
            </span>
            <span
              style={{
                fontFamily: t.bodyFont,
                fontSize: "0.65rem",
                color: t.textMuted,
                maxWidth: 60,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {tm.name}
            </span>
            <span
              style={{
                fontFamily: t.displayFont,
                fontSize: t.id === "terminal" ? "0.9rem" : "0.8rem",
                fontWeight: 700,
                color: done ? t.warm : urgent ? t.warm : t.text,
              }}
            >
              {done ? "Done!" : formatTime(tm.remaining)}
            </span>
            {!done && (
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  position: "relative",
                  flexShrink: 0,
                }}
              >
                <svg
                  width="20"
                  height="20"
                  style={{ transform: "rotate(-90deg)" }}
                >
                  <circle
                    cx="10"
                    cy="10"
                    r="8"
                    fill="none"
                    stroke={`${t.text}15`}
                    strokeWidth="2"
                  />
                  <circle
                    cx="10"
                    cy="10"
                    r="8"
                    fill="none"
                    stroke={urgent ? t.warm : t.accent}
                    strokeWidth="2"
                    strokeDasharray={`${2 * Math.PI * 8}`}
                    strokeDashoffset={`${2 * Math.PI * 8 * (1 - pct / 100)}`}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 1s linear" }}
                  />
                </svg>
              </div>
            )}
          </div>
        );
      })}
      {active.length > 3 && (
        <span
          style={{
            fontFamily: t.bodyFont,
            fontSize: "0.6rem",
            color: t.textDim,
            alignSelf: "center",
          }}
        >
          +{active.length - 3}
        </span>
      )}
    </div>
  );
}
