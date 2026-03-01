import { useState, useEffect } from "react";
import { Globe } from "lucide-react";
import { Panel, PanelHeader } from "./Panel";

const F = "'Geist','Inter',system-ui,sans-serif";
const M = "'JetBrains Mono',ui-monospace,monospace";

const CITIES = [
  { label: "LON", name: "London", tz: "Europe/London" },
  { label: "TYO", name: "Tokyo", tz: "Asia/Tokyo" },
  { label: "SYD", name: "Sydney", tz: "Australia/Sydney" },
  { label: "PAR", name: "Paris", tz: "Europe/Paris" },
];

function getOffset(tz, now) {
  const local = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  const diffMs = local - now;
  const diffHrs = Math.round(diffMs / 3600000);
  const sign = diffHrs >= 0 ? "+" : "";
  return `${sign}${diffHrs}HRS`;
}

function formatTime(tz, now) {
  return now.toLocaleTimeString("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function WorldClockPanel() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <Panel style={{ height: "100%" }}>
      <PanelHeader
        icon={<Globe size={30} color="#FFFFFF" />}
        label="World Clock"
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          flex: 1,
        }}
      >
        {CITIES.map((city, i) => (
          <div key={city.tz}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 0",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span
                  style={{
                    fontFamily: F,
                    fontSize: 16,
                    fontWeight: 600,
                    color: "#FFFFFF",
                    letterSpacing: 2,
                  }}
                >
                  {city.label}
                </span>
                <span
                  style={{
                    fontFamily: F,
                    fontSize: 12,
                    color: "#FFFFFF66",
                    letterSpacing: 1,
                  }}
                >
                  {getOffset(city.tz, now)}
                </span>
              </div>
              <span
                style={{
                  fontFamily: M,
                  fontSize: 20,
                  fontWeight: 600,
                  color: "#FFFFFF",
                }}
              >
                {formatTime(city.tz, now)}
              </span>
            </div>
            {i < CITIES.length - 1 && (
              <div style={{ height: 1, background: "#FFFFFF20" }} />
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}
