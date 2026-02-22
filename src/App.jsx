import { useState } from "react";
import { THEMES } from "./themes";
import { TABS, BIRTHDAYS } from "./data/mockData";
import { useTime } from "./hooks/useTime";
import { useTimers } from "./hooks/useTimers";
import { usePreviewMode } from "./hooks/usePreviewMode";
import { Header } from "./components/Header";
import { CalendarPanel } from "./components/CalendarPanel";
import { WeatherPanel } from "./components/WeatherPanel";
import { PhotoPanel } from "./components/PhotoPanel";
import { FactPanel } from "./components/FactPanel";
import { ConversationsPanel } from "./components/ConversationsPanel";
import { AgentTasksPanel } from "./components/AgentTasksPanel";
import { EventsPanel } from "./components/EventsPanel";
import { BirthdaysPanel } from "./components/BirthdaysPanel";
import { TimersPanel } from "./components/TimersPanel";
import { SearchPanel } from "./components/SearchPanel";

export default function App() {
  const now = useTime();
  const [themeIndex, setThemeIndex] = useState(0);
  const [tab, setTab] = useState("timers");
  const t = THEMES[themeIndex];
  const { timers, addTimer, togglePause, removeTimer, resetTimer, dismissAlert } =
    useTimers();
  const activeTimers = timers.filter((tm) => tm.remaining > 0);
  const alertTimers = timers.filter((tm) => tm.alerted);
  const { preview, scale, tvWidth, tvHeight } = usePreviewMode();

  const dashboard = (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0 }
        body { background: #0A0A0A; overflow: ${preview ? "auto" : "hidden"} }
        ::-webkit-scrollbar { width: 3px }
        ::-webkit-scrollbar-track { background: transparent }
        ::-webkit-scrollbar-thumb { background: ${t.text}15; border-radius: 3px }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes typingDot { 0%,60%,100% { opacity: .3; transform: translateY(0) } 30% { opacity: 1; transform: translateY(-3px) } }
        @keyframes voicePulse { 0% { transform: scale(1); opacity: 0.6 } 100% { transform: scale(1.8); opacity: 0 } }
        @keyframes waveBar { 0% { height: 4px } 100% { height: 16px } }
        @keyframes timerPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.7 } }
        input::placeholder { color: ${t.textDim} }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none }
      `}</style>
      <div
        style={{
          width: preview ? tvWidth : "100vw",
          height: preview ? tvHeight : "100vh",
          background: t.bg,
          padding: "32px 44px 20px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
          transition: "background 0.6s ease",
        }}
      >
        {/* Scanlines overlay */}
        {t.scanlines && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.15) 2px,rgba(0,0,0,0.15) 4px)",
              pointerEvents: "none",
              zIndex: 10,
            }}
          />
        )}

        {/* Ambient glow */}
        <div
          style={{
            position: "absolute",
            top: -200,
            right: -200,
            width: 500,
            height: 500,
            background: `radial-gradient(circle,${t.glow1} 0%,transparent 70%)`,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -200,
            left: -100,
            width: 400,
            height: 400,
            background: `radial-gradient(circle,${t.glow2} 0%,transparent 70%)`,
            pointerEvents: "none",
          }}
        />

        {/* Theme switcher */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 3,
            zIndex: 20,
            background: `${t.text}08`,
            borderRadius: t.radius,
            padding: "3px 5px",
            border: `1px solid ${t.panelBorder}`,
          }}
        >
          {THEMES.map((th, i) => (
            <button
              key={th.id}
              onClick={() => setThemeIndex(i)}
              title={th.name}
              style={{
                width: 30,
                height: 24,
                borderRadius: t.radius / 2.5,
                border:
                  themeIndex === i
                    ? `2px solid ${t.accent}`
                    : "1px solid transparent",
                background:
                  themeIndex === i ? `${t.accent}20` : "transparent",
                cursor: "pointer",
                fontSize: "0.8rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
              }}
            >
              {th.emoji}
            </button>
          ))}
        </div>

        {/* Header */}
        <Header
          t={t}
          now={now}
          timers={timers}
          onTimerTabSwitch={() => setTab("timers")}
        />

        {/* Top row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.3fr 1fr 0.8fr",
            gap: 14,
            flexShrink: 0,
            height: "36%",
          }}
        >
          <CalendarPanel t={t} />
          <WeatherPanel t={t} />
          <PhotoPanel t={t} />
          <FactPanel t={t} />
        </div>

        {/* Bottom row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.2fr",
            gap: 14,
            flex: 1,
            marginTop: 14,
            minHeight: 0,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            {/* Tab bar */}
            <div
              style={{
                display: "flex",
                gap: 3,
                marginBottom: 6,
                flexShrink: 0,
                flexWrap: "wrap",
              }}
            >
              {TABS.map((tb) => (
                <button
                  key={tb.id}
                  onClick={() => setTab(tb.id)}
                  style={{
                    fontFamily: t.bodyFont,
                    fontSize: "0.68rem",
                    fontWeight: 600,
                    padding: "5px 9px",
                    borderRadius: t.radius / 2,
                    background:
                      tab === tb.id ? `${t.accent}15` : `${t.text}04`,
                    border: `1px solid ${tab === tb.id ? t.accent + "25" : t.panelBorder}`,
                    color: tab === tb.id ? t.text : t.textDim,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: "0.78rem" }}>{tb.icon}</span>
                  {tb.label}
                  {tb.id === "agents" && (
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: t.warm,
                        marginLeft: 1,
                      }}
                    />
                  )}
                  {tb.id === "birthdays" &&
                    BIRTHDAYS.some((b) => b.daysUntil === 1) && (
                      <span
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: "#FF6B6B",
                          marginLeft: 1,
                          animation: "typingDot 2s ease infinite",
                        }}
                      />
                    )}
                  {tb.id === "timers" &&
                    (alertTimers.length > 0 ? (
                      <span
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: t.warm,
                          marginLeft: 1,
                          animation: "timerPulse 1s ease infinite",
                        }}
                      />
                    ) : activeTimers.length > 0 ? (
                      <span
                        style={{
                          fontFamily: t.bodyFont,
                          fontSize: "0.5rem",
                          padding: "1px 4px",
                          borderRadius: 6,
                          background: `${t.accent}15`,
                          color: t.accent,
                          marginLeft: 1,
                        }}
                      >
                        {activeTimers.length}
                      </span>
                    ) : null)}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, minHeight: 0 }}>
              {tab === "convos" && <ConversationsPanel t={t} />}
              {tab === "agents" && <AgentTasksPanel t={t} />}
              {tab === "events" && <EventsPanel t={t} />}
              {tab === "birthdays" && <BirthdaysPanel t={t} />}
              {tab === "timers" && (
                <TimersPanel
                  t={t}
                  timers={timers}
                  addTimer={addTimer}
                  togglePause={togglePause}
                  removeTimer={removeTimer}
                  resetTimer={resetTimer}
                  dismissAlert={dismissAlert}
                />
              )}
            </div>
          </div>

          <SearchPanel t={t} />
        </div>

        {/* Theme name footer */}
        <div
          style={{
            position: "absolute",
            bottom: 6,
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: t.bodyFont,
            fontSize: "0.6rem",
            color: t.textDim,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {t.emoji} {t.name}
        </div>
      </div>
    </>
  );

  if (!preview) return dashboard;

  return (
    <div
      style={{
        width: "100vw",
        minHeight: "100vh",
        background: "#0A0A0A",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 4,
        paddingBottom: 12,
      }}
    >
      {/* Scaled dashboard preview */}
      <div
        style={{
          width: tvWidth * scale,
          height: tvHeight * scale,
          overflow: "hidden",
          borderRadius: 8,
          boxShadow: "0 2px 24px rgba(0,0,0,0.5)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: tvWidth,
            height: tvHeight,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {dashboard}
        </div>
      </div>

      {/* Theme switcher — full-size, outside the scaled preview */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginTop: 10,
          padding: "6px 10px",
          background: "rgba(255,255,255,0.05)",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.08)",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {THEMES.map((th, i) => (
          <button
            key={th.id}
            onClick={() => setThemeIndex(i)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 12px",
              borderRadius: 8,
              border:
                themeIndex === i
                  ? `2px solid ${th.accent}`
                  : "1px solid rgba(255,255,255,0.1)",
              background:
                themeIndex === i ? `${th.accent}20` : "transparent",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <span style={{ fontSize: "1rem" }}>{th.emoji}</span>
            <span
              style={{
                fontFamily: "'DM Sans',sans-serif",
                fontSize: "0.7rem",
                fontWeight: 600,
                color:
                  themeIndex === i ? th.accent : "rgba(255,255,255,0.5)",
                whiteSpace: "nowrap",
              }}
            >
              {th.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
