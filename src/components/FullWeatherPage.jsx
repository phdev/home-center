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
      {/* Left: back + title */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={onBack}>
        <ArrowLeft size={30} color="#FFFFFF" />
        <span style={{ fontFamily: F, fontSize: 33, fontWeight: 700, color: "#FFF" }}>Weather</span>
      </div>

      {/* Center: location */}
      <span style={{ fontFamily: F, fontSize: 22, color: "#FFFFFF88" }}>
        {locationName || ""}
      </span>

      {/* Right: date + clock */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontFamily: F, fontSize: 22, color: "#FFFFFF88" }}>{dateStr}</span>
        <span style={{ fontFamily: M, fontSize: 42, fontWeight: 600, color: "#FFF" }}>
          {h}:{m} {ampm}
        </span>
      </div>
    </div>
  );
}

// ─── Current Conditions Sidebar ──────────────────────────────────────

function CurrentSidebar({ current, hourly }) {
  if (!current) return null;

  return (
    <div style={{
      width: 350, flexShrink: 0, display: "flex", flexDirection: "column",
      gap: 24, overflow: "hidden",
    }}>
      {/* Large temperature */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 4 }}>
          <span style={{ fontFamily: M, fontSize: 96, fontWeight: 700, lineHeight: 1, color: "#FFF" }}>
            {current.temp}°
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 32 }}>{current.icon}</span>
          <span style={{ fontFamily: F, fontSize: 24, fontWeight: 500, color: "#FFFFFF88" }}>
            {current.desc}
          </span>
        </div>
        <span style={{ fontFamily: F, fontSize: 18, color: "#FFFFFF66" }}>
          Feels like {current.feelsLike}°
        </span>
      </div>

      {/* Stats */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 14,
        padding: "16px 0", borderTop: "1px solid #FFFFFF20", borderBottom: "1px solid #FFFFFF20",
      }}>
        <StatRow icon={<Wind size={20} color="#FFFFFF66" />} label="Wind" value={`${current.windSpeed} ${current.windUnit} ${current.windDir}`} />
        <StatRow icon={<Droplets size={20} color="#FFFFFF66" />} label="Humidity" value={`${current.humidity}%`} />
        <StatRow icon={<Thermometer size={20} color="#FFFFFF66" />} label="Hi / Lo" value={`${current.hi}° / ${current.lo}°`} />
      </div>

      {/* Hourly forecast */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <CloudSun size={20} color="#FFF" />
          <span style={{ fontFamily: F, fontSize: 18, fontWeight: 600, color: "#FFF" }}>Hourly</span>
        </div>
        <div style={{
          display: "flex", gap: 0, borderRadius: 8, overflow: "hidden",
          border: "1px solid #FFFFFF20",
        }}>
          {(hourly || []).slice(0, 8).map((h, i) => (
            <div key={i} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              gap: 4, padding: "10px 2px",
              background: i === 0 ? "#FFFFFF10" : "transparent",
              borderRight: i < 7 ? "1px solid #FFFFFF10" : "none",
            }}>
              <span style={{ fontFamily: F, fontSize: 12, color: "#FFFFFF66" }}>{h.h}</span>
              <span style={{ fontSize: 18 }}>{h.i}</span>
              <span style={{ fontFamily: M, fontSize: 15, fontWeight: 600, color: "#FFF" }}>{h.t}°</span>
              {h.p > 0 && (
                <span style={{ fontFamily: F, fontSize: 10, color: "#60A5FA" }}>{h.p}%</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatRow({ icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {icon}
      <span style={{ fontFamily: F, fontSize: 16, color: "#FFFFFF66", width: 70 }}>{label}</span>
      <span style={{ fontFamily: M, fontSize: 18, fontWeight: 500, color: "#FFF" }}>{value}</span>
    </div>
  );
}

// ─── 7-Day Forecast ──────────────────────────────────────────────────

function TempBar({ lo, hi, globalMin, globalMax }) {
  const range = globalMax - globalMin || 1;
  const leftPct = ((lo - globalMin) / range) * 100;
  const widthPct = ((hi - lo) / range) * 100;

  return (
    <div style={{
      flex: 1, height: 8, borderRadius: 4, position: "relative",
      background: "#FFFFFF10",
    }}>
      <div style={{
        position: "absolute", top: 0, height: "100%", borderRadius: 4,
        left: `${leftPct}%`, width: `${Math.max(widthPct, 3)}%`,
        background: "linear-gradient(to right, #60A5FA, #F97316)",
      }} />
    </div>
  );
}

function DailyForecast({ daily }) {
  if (!daily || daily.length === 0) return null;

  const globalMin = Math.min(...daily.map((d) => d.lo));
  const globalMax = Math.max(...daily.map((d) => d.hi));

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      border: "1px solid #FFFFFF", borderRadius: 8, overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        height: 50, display: "flex", alignItems: "center", padding: "0 20px",
        background: "#FFFFFF08", borderBottom: "1px solid #FFFFFF20",
      }}>
        <span style={{ fontFamily: F, fontSize: 22, fontWeight: 600, color: "#FFF" }}>
          7-Day Forecast
        </span>
      </div>

      {/* Day rows */}
      {daily.map((day, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 16, padding: "0 20px",
          height: `calc((100% - 50px) / ${daily.length})`,
          borderBottom: i < daily.length - 1 ? "1px solid #FFFFFF10" : "none",
          background: i === 0 ? "#FFFFFF08" : "transparent",
        }}>
          {/* Day name */}
          <span style={{
            fontFamily: F, fontSize: 20, fontWeight: i === 0 ? 600 : 500,
            color: i === 0 ? "#FFF" : "#FFFFFFCC", width: 80,
          }}>
            {day.d}
          </span>

          {/* Icon */}
          <span style={{ fontSize: 28, width: 40, textAlign: "center" }}>{day.i}</span>

          {/* Description */}
          <span style={{
            fontFamily: F, fontSize: 17, color: "#FFFFFF88", width: 180,
            overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
          }}>
            {day.desc}
          </span>

          {/* Lo temp */}
          <span style={{
            fontFamily: M, fontSize: 20, color: "#60A5FA", width: 45, textAlign: "right",
          }}>
            {day.lo}°
          </span>

          {/* Temp bar */}
          <TempBar lo={day.lo} hi={day.hi} globalMin={globalMin} globalMax={globalMax} />

          {/* Hi temp */}
          <span style={{
            fontFamily: M, fontSize: 20, fontWeight: 600, color: "#F97316", width: 45,
          }}>
            {day.hi}°
          </span>

          {/* Precipitation */}
          <div style={{
            display: "flex", alignItems: "center", gap: 4, width: 60, justifyContent: "flex-end",
          }}>
            {day.precip > 0 && (
              <>
                <Droplets size={14} color="#60A5FA" />
                <span style={{ fontFamily: M, fontSize: 15, color: "#60A5FA" }}>{day.precip}%</span>
              </>
            )}
          </div>
        </div>
      ))}
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
        flex: 1, display: "flex", gap: 16, padding: 16, minHeight: 0,
      }}>
        {loading && (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: F, fontSize: 24, color: "#FFFFFF66",
          }}>
            Loading weather...
          </div>
        )}
        {error && !loading && (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: F, fontSize: 24, color: "#FFFFFF66",
          }}>
            {error}
          </div>
        )}
        {weatherData && !loading && (
          <>
            <CurrentSidebar current={weatherData.current} hourly={weatherData.hourly} />
            <DailyForecast daily={weatherData.daily} />
          </>
        )}
      </div>
    </div>
  );
}
