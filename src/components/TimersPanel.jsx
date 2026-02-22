import { useState } from "react";
import { Panel, PanelHeader } from "./Panel";
import { TIMER_PRESETS } from "../data/mockData";
import { formatTime } from "../utils/formatTime";

export function TimersPanel({
  t,
  timers,
  addTimer,
  togglePause,
  removeTimer,
  resetTimer,
  dismissAlert,
}) {
  const [customMin, setCustomMin] = useState("");
  const [customName, setCustomName] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const handlePreset = (p) => {
    addTimer(p.label, p.sec);
  };

  const handleCustom = () => {
    const mins = parseInt(customMin);
    if (isNaN(mins) || mins <= 0) return;
    addTimer(customName.trim() || `${mins} min`, mins * 60);
    setCustomMin("");
    setCustomName("");
    setShowCustom(false);
  };

  const active = timers.filter((tm) => tm.remaining > 0);
  const completed = timers.filter((tm) => tm.remaining <= 0);

  return (
    <Panel t={t} style={{ height: "100%" }}>
      <PanelHeader
        t={t}
        icon={"\u23F1\uFE0F"}
        label="Timers"
        right={
          timers.length > 0 && (
            <span
              style={{
                fontFamily: t.bodyFont,
                fontSize: "0.6rem",
                padding: "2px 8px",
                borderRadius: 10,
                background: `${t.accent}15`,
                color: t.accent,
                fontWeight: 600,
              }}
            >
              {active.length} running
            </span>
          )
        }
      />

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {/* Quick presets */}
        <div>
          <div
            style={{
              fontFamily: t.bodyFont,
              fontSize: "0.6rem",
              color: t.textDim,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 6,
            }}
          >
            Quick Start
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {TIMER_PRESETS.map((p, i) => (
              <button
                key={i}
                onClick={() => handlePreset(p)}
                style={{
                  fontFamily: t.bodyFont,
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  padding: "8px 12px",
                  borderRadius: t.radius / 2,
                  background: `${t.accent}08`,
                  border: `1px solid ${t.accent}15`,
                  color: t.text,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: "0.85rem" }}>{p.icon}</span>
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setShowCustom(!showCustom)}
              style={{
                fontFamily: t.bodyFont,
                fontSize: "0.72rem",
                fontWeight: 600,
                padding: "8px 12px",
                borderRadius: t.radius / 2,
                background: showCustom ? `${t.accent}15` : `${t.text}06`,
                border: `1px solid ${showCustom ? t.accent + "25" : t.panelBorder}`,
                color: t.textMuted,
                cursor: "pointer",
              }}
            >
              + Custom
            </button>
          </div>
        </div>

        {/* Custom timer input */}
        {showCustom && (
          <div
            style={{
              display: "flex",
              gap: 6,
              padding: "8px 10px",
              borderRadius: t.radius / 2,
              background: `${t.accent}06`,
              border: `1px solid ${t.accent}12`,
            }}
          >
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Name..."
              style={{
                width: 100,
                background: t.inputBg,
                border: `1px solid ${t.inputBorder}`,
                borderRadius: t.radius / 3,
                padding: "6px 8px",
                color: t.text,
                fontFamily: t.bodyFont,
                fontSize: "0.75rem",
                outline: "none",
              }}
            />
            <input
              value={customMin}
              onChange={(e) => setCustomMin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCustom()}
              placeholder="Min"
              type="number"
              style={{
                width: 60,
                background: t.inputBg,
                border: `1px solid ${t.inputBorder}`,
                borderRadius: t.radius / 3,
                padding: "6px 8px",
                color: t.text,
                fontFamily: t.bodyFont,
                fontSize: "0.75rem",
                outline: "none",
              }}
            />
            <button
              onClick={handleCustom}
              style={{
                background: t.accent,
                border: "none",
                borderRadius: t.radius / 3,
                padding: "6px 12px",
                color:
                  t.id === "paper" || t.id === "playroom" ? "#fff" : "#0A0A0A",
                fontFamily: t.bodyFont,
                fontSize: "0.72rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Start
            </button>
          </div>
        )}

        {/* Active timers */}
        {active.length > 0 && (
          <>
            <div
              style={{
                fontFamily: t.bodyFont,
                fontSize: "0.6rem",
                color: t.textDim,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginTop: 4,
              }}
            >
              Active
            </div>
            {active.map((tm) => {
              const pct =
                tm.total > 0 ? (tm.remaining / tm.total) * 100 : 0;
              const urgent = tm.remaining <= 60;
              return (
                <div
                  key={tm.id}
                  style={{
                    padding: "10px 12px",
                    borderRadius: t.radius / 2,
                    background: urgent ? `${t.warm}08` : `${t.text}04`,
                    border: `1px solid ${urgent ? t.warm + "20" : t.panelBorder}`,
                    transition: "all 0.3s",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <div
                      style={{
                        position: "relative",
                        width: 44,
                        height: 44,
                        flexShrink: 0,
                      }}
                    >
                      <svg
                        width="44"
                        height="44"
                        style={{ transform: "rotate(-90deg)" }}
                      >
                        <circle
                          cx="22"
                          cy="22"
                          r="18"
                          fill="none"
                          stroke={`${t.text}10`}
                          strokeWidth="3"
                        />
                        <circle
                          cx="22"
                          cy="22"
                          r="18"
                          fill="none"
                          stroke={urgent ? t.warm : t.accent}
                          strokeWidth="3"
                          strokeDasharray={`${2 * Math.PI * 18}`}
                          strokeDashoffset={`${2 * Math.PI * 18 * (1 - pct / 100)}`}
                          strokeLinecap="round"
                          style={{
                            transition: "stroke-dashoffset 1s linear",
                          }}
                        />
                      </svg>
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: t.bodyFont,
                          fontSize: "0.55rem",
                          fontWeight: 600,
                          color: t.text,
                        }}
                      >
                        {Math.ceil(pct)}%
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontFamily: t.bodyFont,
                          fontSize: "0.85rem",
                          fontWeight: 600,
                          color: t.text,
                        }}
                      >
                        {tm.name}
                      </div>
                      <div
                        style={{
                          fontFamily: t.displayFont,
                          fontSize:
                            t.id === "terminal" ? "1.6rem" : "1.4rem",
                          fontWeight: 700,
                          color: urgent ? t.warm : t.text,
                          lineHeight: 1,
                          marginTop: 2,
                        }}
                      >
                        {formatTime(tm.remaining)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => togglePause(tm.id)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: t.radius / 3,
                          background: `${t.text}08`,
                          border: `1px solid ${t.panelBorder}`,
                          color: t.text,
                          fontSize: "0.85rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {tm.paused ? "\u25B6" : "\u23F8"}
                      </button>
                      <button
                        onClick={() => resetTimer(tm.id)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: t.radius / 3,
                          background: `${t.text}08`,
                          border: `1px solid ${t.panelBorder}`,
                          color: t.textMuted,
                          fontSize: "0.75rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {"\u21BB"}
                      </button>
                      <button
                        onClick={() => removeTimer(tm.id)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: t.radius / 3,
                          background: `${t.warm}10`,
                          border: `1px solid ${t.warm}20`,
                          color: t.warm,
                          fontSize: "0.75rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {"\u2715"}
                      </button>
                    </div>
                  </div>
                  {tm.paused && (
                    <div
                      style={{
                        fontFamily: t.bodyFont,
                        fontSize: "0.6rem",
                        color: t.warm,
                        fontWeight: 600,
                        marginTop: 4,
                      }}
                    >
                      {"\u23F8"} Paused
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Completed timers */}
        {completed.length > 0 && (
          <>
            <div
              style={{
                fontFamily: t.bodyFont,
                fontSize: "0.6rem",
                color: t.textDim,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginTop: 4,
              }}
            >
              Completed
            </div>
            {completed.map((tm) => (
              <div
                key={tm.id}
                style={{
                  padding: "8px 10px",
                  borderRadius: t.radius / 2,
                  background: tm.alerted
                    ? `${t.warm}12`
                    : `${t.accent2}06`,
                  border: `1px solid ${tm.alerted ? t.warm + "25" : t.accent2 + "15"}`,
                  animation: tm.alerted
                    ? "timerPulse 1.5s ease infinite"
                    : "none",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <span style={{ fontSize: "1.3rem" }}>
                    {tm.alerted ? "\u{1F514}" : "\u2705"}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontFamily: t.bodyFont,
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        color: t.text,
                      }}
                    >
                      {tm.name}
                    </div>
                    <div
                      style={{
                        fontFamily: t.bodyFont,
                        fontSize: "0.6rem",
                        color: t.textDim,
                      }}
                    >
                      {tm.alerted ? "Timer finished!" : "Done"}
                    </div>
                  </div>
                  {tm.alerted && (
                    <button
                      onClick={() => dismissAlert(tm.id)}
                      style={{
                        fontFamily: t.bodyFont,
                        fontSize: "0.65rem",
                        padding: "4px 10px",
                        borderRadius: t.radius / 3,
                        background: t.accent,
                        border: "none",
                        color:
                          t.id === "paper" || t.id === "playroom"
                            ? "#fff"
                            : "#0A0A0A",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Dismiss
                    </button>
                  )}
                  <button
                    onClick={() => resetTimer(tm.id)}
                    style={{
                      fontFamily: t.bodyFont,
                      fontSize: "0.6rem",
                      padding: "4px 8px",
                      borderRadius: t.radius / 3,
                      background: `${t.text}06`,
                      border: `1px solid ${t.panelBorder}`,
                      color: t.textMuted,
                      cursor: "pointer",
                    }}
                  >
                    {"\u21BB"} Again
                  </button>
                  <button
                    onClick={() => removeTimer(tm.id)}
                    style={{
                      fontFamily: t.bodyFont,
                      fontSize: "0.6rem",
                      padding: "4px 8px",
                      borderRadius: t.radius / 3,
                      background: `${t.warm}10`,
                      border: `1px solid ${t.warm}15`,
                      color: t.warm,
                      cursor: "pointer",
                    }}
                  >
                    {"\u2715"}
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {timers.length === 0 && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 8,
              opacity: 0.5,
            }}
          >
            <span style={{ fontSize: "2.5rem" }}>{"\u23F1\uFE0F"}</span>
            <div
              style={{
                fontFamily: t.bodyFont,
                fontSize: "0.85rem",
                color: t.textDim,
              }}
            >
              No timers yet — tap a preset to start
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
