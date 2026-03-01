import { useTime } from "../hooks/useTime";
import { ArrowLeft, Wind, Droplets, Thermometer, CloudSun } from "lucide-react";

const F = "'Geist','Inter',system-ui,sans-serif";
const M = "'JetBrains Mono',ui-monospace,monospace";
const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Top Bar ─────────────────────────────────────────────────────────

function TopBar({ onBack, locationName, now }) {
  const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const dateStr = `${dayNames[now.getDay()]}, ${SHORT_MONTHS[now.getMonth()]} ${now.getDate()}`;
  const h = now.getHours() % 12 || 12;
  const m = String(now.getMinutes()).padStart(2, "0");
  const ampm = now.getHours() >= 12 ? "PM" : "AM";

  return (
    <div style={{
      width: "100%", height: 70, display: "flex", alignItems: "center",
      justifyContent: "space-between", padding: "0 24px", flexShrink: 0,
      borderBottom: "1px solid #FFFFFF30",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={onBack}>
        <ArrowLeft size={30} color="#FFFFFF" />
        <span style={{ fontFamily: F, fontSize: 33, fontWeight: 700, color: "#FFF" }}>Weather</span>
      </div>
      <span style={{ fontFamily: F, fontSize: 22, color: "#FFFFFF88" }}>
        {locationName || ""}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontFamily: F, fontSize: 22, color: "#FFFFFF88" }}>{dateStr}</span>
        <span style={{ fontFamily: M, fontSize: 42, fontWeight: 600, color: "#FFF" }}>
          {h}:{m} {ampm}
        </span>
      </div>
    </div>
  );
}

// ─── Current Conditions Row ─────────────────────────────────────────

function CurrentRow({ current, hourly }) {
  if (!current) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 32, flexShrink: 0,
    }}>
      {/* Big temp + condition */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontFamily: M, fontSize: 80, fontWeight: 700, lineHeight: 1, color: "#FFF" }}>
          {current.temp}°
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 24 }}>{current.icon}</span>
            <span style={{ fontFamily: F, fontSize: 20, fontWeight: 500, color: "#FFFFFF88" }}>
              {current.desc}
            </span>
          </div>
          <span style={{ fontFamily: F, fontSize: 15, color: "#FFFFFF66" }}>
            Feels like {current.feelsLike}°
          </span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 60, background: "#FFFFFF20" }} />

      {/* Stats */}
      <div style={{ display: "flex", gap: 24 }}>
        <StatChip icon={<Wind size={16} color="#FFFFFF66" />} label="Wind" value={`${current.windSpeed} ${current.windUnit} ${current.windDir}`} />
        <StatChip icon={<Droplets size={16} color="#FFFFFF66" />} label="Humidity" value={`${current.humidity}%`} />
        <StatChip icon={<Thermometer size={16} color="#FFFFFF66" />} label="Hi / Lo" value={`${current.hi}° / ${current.lo}°`} />
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 60, background: "#FFFFFF20" }} />

      {/* Hourly */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <CloudSun size={16} color="#FFF" />
        <span style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: "#FFF", marginRight: 8 }}>Hourly</span>
        <div style={{
          display: "flex", gap: 0, borderRadius: 8, overflow: "hidden",
          border: "1px solid #FFFFFF20",
        }}>
          {(hourly || []).slice(0, 8).map((h, i) => (
            <div key={i} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 2, padding: "6px 8px",
              background: i === 0 ? "#FFFFFF10" : "transparent",
              borderRight: i < 7 ? "1px solid #FFFFFF10" : "none",
            }}>
              <span style={{ fontFamily: F, fontSize: 11, color: "#FFFFFF66" }}>{h.h}</span>
              <span style={{ fontSize: 14 }}>{h.i}</span>
              <span style={{ fontFamily: M, fontSize: 13, fontWeight: 600, color: "#FFF" }}>{h.t}°</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatChip({ icon, label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {icon}
        <span style={{ fontFamily: F, fontSize: 13, color: "#FFFFFF66" }}>{label}</span>
      </div>
      <span style={{ fontFamily: M, fontSize: 16, fontWeight: 500, color: "#FFF" }}>{value}</span>
    </div>
  );
}

// ─── Vertical Temp Bar ──────────────────────────────────────────────

function VerticalTempBar({ lo, hi, globalMin, globalMax }) {
  const range = globalMax - globalMin || 1;
  const bottomPct = ((lo - globalMin) / range) * 100;
  const heightPct = ((hi - lo) / range) * 100;

  return (
    <div style={{
      width: 8, flex: 1, borderRadius: 4, position: "relative",
      background: "#FFFFFF10",
    }}>
      <div style={{
        position: "absolute", left: 0, width: "100%", borderRadius: 4,
        bottom: `${bottomPct}%`, height: `${Math.max(heightPct, 5)}%`,
        background: "linear-gradient(to top, #60A5FA, #F97316)",
      }} />
    </div>
  );
}

// ─── Day Column ─────────────────────────────────────────────────────

function DayColumn({ day, index, globalMin, globalMax }) {
  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
      gap: 12, padding: "20px 0",
      background: index === 0 ? "#FFFFFF08" : "transparent",
      borderRight: index < 6 ? "1px solid #FFFFFF10" : "none",
    }}>
      {/* Day name */}
      <span style={{
        fontFamily: F, fontSize: 20, fontWeight: index === 0 ? 700 : 500,
        color: index === 0 ? "#FFF" : "#FFFFFFCC",
      }}>
        {day.d}
      </span>

      {/* Icon */}
      <span style={{ fontSize: 36 }}>{day.i}</span>

      {/* Description */}
      <span style={{
        fontFamily: F, fontSize: 14, color: "#FFFFFF66", textAlign: "center",
        maxWidth: 100, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
      }}>
        {day.desc}
      </span>

      {/* Hi temp */}
      <span style={{ fontFamily: M, fontSize: 22, fontWeight: 600, color: "#F97316" }}>
        {day.hi}°
      </span>

      {/* Vertical temp bar */}
      <VerticalTempBar lo={day.lo} hi={day.hi} globalMin={globalMin} globalMax={globalMax} />

      {/* Lo temp */}
      <span style={{ fontFamily: M, fontSize: 22, color: "#60A5FA" }}>
        {day.lo}°
      </span>

      {/* Precipitation */}
      <div style={{ height: 20, display: "flex", alignItems: "center", gap: 4 }}>
        {day.precip > 0 && (
          <>
            <Droplets size={12} color="#60A5FA" />
            <span style={{ fontFamily: M, fontSize: 13, color: "#60A5FA" }}>{day.precip}%</span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── 7-Day Forecast (Columns) ───────────────────────────────────────

function DailyForecast({ daily }) {
  if (!daily || daily.length === 0) return null;

  const globalMin = Math.min(...daily.map((d) => d.lo));
  const globalMax = Math.max(...daily.map((d) => d.hi));

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      border: "1px solid #FFFFFF", borderRadius: 8, overflow: "hidden", minHeight: 0,
    }}>
      {/* Header */}
      <div style={{
        height: 44, display: "flex", alignItems: "center", padding: "0 20px",
        background: "#FFFFFF08", borderBottom: "1px solid #FFFFFF20", flexShrink: 0,
      }}>
        <span style={{ fontFamily: F, fontSize: 18, fontWeight: 600, color: "#FFF" }}>
          7-Day Forecast
        </span>
      </div>

      {/* Day columns */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {daily.map((day, i) => (
          <DayColumn key={i} day={day} index={i} globalMin={globalMin} globalMax={globalMax} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────

export function FullWeatherPage({ weatherData, loading, error, locationName, onBack }) {
  const now = useTime();

  return (
    <div style={{
      width: "100%", height: "100vh", background: "#000", display: "flex",
      flexDirection: "column", overflow: "hidden",
      fontFamily: F, color: "#FFF",
    }}>
      <TopBar onBack={onBack} locationName={locationName} now={now} />
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: 16, minHeight: 0,
      }}>
        {loading && (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, color: "#FFFFFF66",
          }}>
            Loading weather...
          </div>
        )}
        {error && !loading && (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, color: "#FFFFFF66",
          }}>
            {error}
          </div>
        )}
        {weatherData && !loading && (
          <>
            <CurrentRow current={weatherData.current} hourly={weatherData.hourly} />
            <DailyForecast daily={weatherData.daily} />
          </>
        )}
      </div>
    </div>
  );
}
