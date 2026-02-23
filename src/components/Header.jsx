import { Clock } from "./Clock";
import { WeatherStrip } from "./WeatherStrip";
import { TimerStrip } from "./TimerStrip";

export function Header({ t, now, timers, onTimerTabSwitch, weatherData, onOpenSettings, isMobile }) {
  if (isMobile) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
          flexShrink: 0,
          ...(t.headerBorder
            ? { borderBottom: `2px solid ${t.text}`, paddingBottom: 8 }
            : {}),
        }}
      >
        <div
          style={{
            fontFamily: t.displayFont,
            fontSize: t.id === "terminal" ? "1.2rem" : "1.1rem",
            fontWeight: 700,
            color: t.text,
          }}
        >
          {t.id === "terminal" ? "> HOME_" : "Home"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Clock t={t} now={now} />
          <button
            onClick={onOpenSettings}
            style={{
              background: `${t.text}06`,
              border: `1px solid ${t.panelBorder}`,
              borderRadius: t.radius / 2,
              padding: "6px 8px",
              color: t.textDim,
              fontSize: "1rem",
              cursor: "pointer",
              lineHeight: 1,
              transition: "all 0.2s",
            }}
          >
            ⚙
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
        flexShrink: 0,
        ...(t.headerBorder
          ? { borderBottom: `2px solid ${t.text}`, paddingBottom: 12 }
          : {}),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div
          style={{
            fontFamily: t.displayFont,
            fontSize: t.id === "terminal" ? "1.6rem" : "1.5rem",
            fontWeight: 700,
            color: t.text,
          }}
        >
          {t.id === "terminal" ? "> HOME_" : "Home"}
        </div>
        <WeatherStrip t={t} weatherData={weatherData} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <TimerStrip t={t} timers={timers} onTabSwitch={onTimerTabSwitch} />
        <Clock t={t} now={now} />
        <button
          onClick={onOpenSettings}
          style={{
            background: `${t.text}06`,
            border: `1px solid ${t.panelBorder}`,
            borderRadius: t.radius / 2,
            padding: "6px 8px",
            color: t.textDim,
            fontSize: "1rem",
            cursor: "pointer",
            lineHeight: 1,
            transition: "all 0.2s",
          }}
        >
          ⚙
        </button>
      </div>
    </div>
  );
}
