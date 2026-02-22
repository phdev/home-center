import { Clock } from "./Clock";
import { WeatherStrip } from "./WeatherStrip";
import { TimerStrip } from "./TimerStrip";

export function Header({ t, now, timers, onTimerTabSwitch }) {
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
        <WeatherStrip t={t} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <TimerStrip t={t} timers={timers} onTabSwitch={onTimerTabSwitch} />
        <Clock t={t} now={now} />
      </div>
    </div>
  );
}
