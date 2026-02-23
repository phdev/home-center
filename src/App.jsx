import { useState } from "react";
import { THEMES } from "./themes";
import { BIRTHDAYS } from "./data/mockData";
import { useTime } from "./hooks/useTime";
import { useTimers } from "./hooks/useTimers";
import { usePreviewMode } from "./hooks/usePreviewMode";
import { useSettings } from "./hooks/useSettings";
import { useWeather } from "./hooks/useWeather";
import { useCalendar } from "./hooks/useCalendar";
import { usePhotos } from "./hooks/usePhotos";
import { Header } from "./components/Header";
import { CalendarPanel } from "./components/CalendarPanel";
import { WeatherPanel } from "./components/WeatherPanel";
import { PhotoPanel } from "./components/PhotoPanel";
import { FactPanel } from "./components/FactPanel";
import { AgentTasksPanel } from "./components/AgentTasksPanel";
import { EventsPanel } from "./components/EventsPanel";
import { BirthdaysPanel } from "./components/BirthdaysPanel";
import { TimersPanel } from "./components/TimersPanel";
import { SearchPanel } from "./components/SearchPanel";
import { SettingsModal } from "./components/SettingsModal";

export default function App() {
  const now = useTime();
  const [themeIndex, setThemeIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const t = THEMES[themeIndex];
  const { timers, addTimer, togglePause, removeTimer, resetTimer, dismissAlert } =
    useTimers();
  const { isMobile, scale, tvWidth, tvHeight } = usePreviewMode();
  const [viewMode, setViewMode] = useState("responsive"); // "responsive" | "tv"
  const useMobileLayout = isMobile && viewMode === "responsive";
  const { settings, update: updateSettings } = useSettings();

  // Real API data hooks (pass worker settings for server-side proxy)
  const weather = useWeather(settings.weather);
  const calendar = useCalendar(settings.calendar, settings.worker);
  const photos = usePhotos(settings.photos, settings.worker);

  const dashboard = (
    <>
      <style>{`
        body { overflow: ${useMobileLayout ? "auto" : "hidden"} }
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
        select { color-scheme: dark }
      `}</style>
      <div
        style={{
          width: "100%",
          minHeight: useMobileLayout ? "100vh" : undefined,
          height: useMobileLayout ? "auto" : "calc(100vh - 56px)",
          background: t.bg,
          padding: useMobileLayout ? "12px 12px 80px" : "20px 44px 12px",
          display: "flex",
          flexDirection: "column",
          overflow: useMobileLayout ? "visible" : "hidden",
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

        {/* Header */}
        <Header
          t={t}
          now={now}
          timers={timers}
          onTimerTabSwitch={() => {}}
          weatherData={weather.data}
          onOpenSettings={() => setShowSettings(true)}
          isMobile={useMobileLayout}
        />

        {/* Top row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: useMobileLayout ? "1fr" : "1fr 1.3fr 1fr 0.8fr",
            gap: useMobileLayout ? 10 : 14,
            flexShrink: useMobileLayout ? undefined : 0,
            height: useMobileLayout ? "auto" : "36%",
          }}
        >
          <CalendarPanel
            t={t}
            events={calendar.events}
            loading={calendar.loading}
            error={calendar.error}
          />
          <WeatherPanel
            t={t}
            weatherData={weather.data}
            loading={weather.loading}
            error={weather.error}
          />
          <div style={useMobileLayout ? { height: 220 } : { height: "100%" }}>
            <PhotoPanel
              t={t}
              photos={photos.photos}
              photosLoading={photos.loading}
            />
          </div>
          <FactPanel t={t} />
        </div>

        {/* Bottom row — all sections visible */}
        <div
          style={{
            display: useMobileLayout ? "flex" : "grid",
            flexDirection: useMobileLayout ? "column" : undefined,
            gridTemplateColumns: useMobileLayout ? undefined : "1fr 1fr 1.2fr",
            gap: useMobileLayout ? 10 : 14,
            flex: useMobileLayout ? undefined : 1,
            marginTop: useMobileLayout ? 10 : 14,
            minHeight: 0,
          }}
        >
          {useMobileLayout ? (
            <>
              <AgentTasksPanel t={t} />
              <EventsPanel t={t} />
              <TimersPanel
                t={t}
                timers={timers}
                addTimer={addTimer}
                togglePause={togglePause}
                removeTimer={removeTimer}
                resetTimer={resetTimer}
                dismissAlert={dismissAlert}
              />
              <BirthdaysPanel t={t} />
              <div style={{ minHeight: 350 }}>
                <SearchPanel t={t} llmSettings={settings.llm} workerSettings={settings.worker} />
              </div>
            </>
          ) : (
            <>
              {/* Left column: Agents + Birthdays stacked */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  minHeight: 0,
                }}
              >
                <div style={{ flex: 1, minHeight: 0 }}>
                  <AgentTasksPanel t={t} />
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <BirthdaysPanel t={t} />
                </div>
              </div>

              {/* Middle column: Events + Timers stacked */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  minHeight: 0,
                }}
              >
                <div style={{ flex: 1, minHeight: 0 }}>
                  <EventsPanel t={t} />
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <TimersPanel
                    t={t}
                    timers={timers}
                    addTimer={addTimer}
                    togglePause={togglePause}
                    removeTimer={removeTimer}
                    resetTimer={resetTimer}
                    dismissAlert={dismissAlert}
                  />
                </div>
              </div>

              {/* Right column: Ask Anything (with History tab) */}
              <SearchPanel t={t} llmSettings={settings.llm} workerSettings={settings.worker} />
            </>
          )}
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

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          t={t}
          settings={settings}
          onSave={updateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );

  const themePicker = (
    <div
      id="theme-picker"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 6,
        padding: "10px 12px 14px",
        background: "rgba(10,10,10,0.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderTop: "1px solid rgba(255,255,255,0.2)",
        flexWrap: "wrap",
      }}
    >
      {isMobile && (
        <button
          onClick={() => setViewMode(viewMode === "responsive" ? "tv" : "responsive")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "8px 10px",
            borderRadius: 10,
            border: `1px solid ${t.accent}40`,
            background: `${t.accent}15`,
            cursor: "pointer",
            WebkitAppearance: "none",
            appearance: "none",
            marginRight: 4,
          }}
        >
          <span style={{ fontSize: "1rem", lineHeight: 1 }}>{viewMode === "responsive" ? "📺" : "📱"}</span>
        </button>
      )}
      {THEMES.map((th, i) => (
        <button
          key={th.id}
          onClick={() => setThemeIndex(i)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: isMobile ? 0 : 6,
            padding: isMobile ? "8px 10px" : "8px 14px",
            borderRadius: 10,
            border:
              themeIndex === i
                ? `2px solid ${th.accent}`
                : "1px solid rgba(255,255,255,0.25)",
            background:
              themeIndex === i ? `${th.accent}35` : "rgba(255,255,255,0.06)",
            cursor: "pointer",
            transition: "all 0.2s",
            WebkitAppearance: "none",
            appearance: "none",
          }}
        >
          <span style={{ fontSize: isMobile ? "1.2rem" : "1rem", lineHeight: 1 }}>{th.emoji}</span>
          {!isMobile && (
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "0.8rem",
                fontWeight: 600,
                color:
                  themeIndex === i ? th.accent : "rgba(255,255,255,0.8)",
                whiteSpace: "nowrap",
              }}
            >
              {th.name}
            </span>
          )}
        </button>
      ))}
    </div>
  );

  if (isMobile && viewMode === "tv") {
    return (
      <>
        <div
          style={{
            width: "100vw",
            minHeight: "100vh",
            background: "#0A0A0A",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: 4,
            paddingBottom: 60,
          }}
        >
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
        </div>
        {themePicker}
      </>
    );
  }

  return (
    <>
      {dashboard}
      {themePicker}
    </>
  );
}
