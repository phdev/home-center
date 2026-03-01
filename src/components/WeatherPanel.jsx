import { CloudSun, Wind, Droplets, Thermometer } from "lucide-react";
import { Panel, PanelHeader } from "./Panel";

const F = "'Geist','Inter',system-ui,sans-serif";
const M = "'JetBrains Mono',ui-monospace,monospace";

export function WeatherPanel({ t, weatherData, loading, error }) {
  const current = weatherData?.current;
  const temp = current?.temp ?? "34";
  const condition = current?.condition ?? "Partly Cloudy";
  const feelsLike = current?.feelsLike ?? "28";
  const wind = current?.wind ?? "12 mph NW";
  const humidity = current?.humidity ?? "62";
  const hi = current?.hi ?? "38";
  const lo = current?.lo ?? "24";

  return (
    <Panel style={{ height: "100%" }}>
      <PanelHeader
        icon={<CloudSun size={30} color="#FFFFFF" />}
        label="Weather"
      />
      {loading && (
        <div
          style={{
            fontFamily: F, fontSize: 16.5, color: "#FFFFFF66",
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          Loading weather…
        </div>
      )}
      {error && (
        <div style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66", padding: 8 }}>
          {error}
        </div>
      )}
      {!loading && (
        <div style={{ display: "flex", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontFamily: M, fontSize: 72, fontWeight: 700, lineHeight: 1, color: "#FFFFFF" }}>
              {temp}°F
            </span>
            <span style={{ fontFamily: F, fontSize: 21, fontWeight: 500, color: "#FFFFFF88" }}>
              {condition}
            </span>
            <span style={{ fontFamily: F, fontSize: 18, color: "#FFFFFF66" }}>
              Feels like {feelsLike}°F
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", justifyContent: "flex-end" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Wind size={21} color="#FFFFFF66" />
              <span style={{ fontFamily: F, fontSize: 18, color: "#FFFFFF66" }}>{wind}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Droplets size={21} color="#FFFFFF66" />
              <span style={{ fontFamily: F, fontSize: 18, color: "#FFFFFF66" }}>{humidity}% humidity</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Thermometer size={21} color="#FFFFFF66" />
              <span style={{ fontFamily: F, fontSize: 18, color: "#FFFFFF66" }}>H: {hi}° / L: {lo}°</span>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
