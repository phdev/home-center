import { Calendar } from "lucide-react";
import { Panel, PanelHeader } from "./Panel";
import { CALENDAR } from "../data/mockData";

const F = "'Geist','Inter',system-ui,sans-serif";
const M = "'JetBrains Mono',ui-monospace,monospace";

function dedup(events) {
  const seen = new Set();
  return events.filter((e) => {
    const key = `${e.time}|${e.title.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function CalendarPanel({ t, events, loading, error, selected }) {
  const items = dedup(events || CALENDAR);

  // Group events by day label
  const groups = [];
  let lastDay = null;
  for (const e of items) {
    const day = e.day || "Today";
    if (day !== lastDay) {
      groups.push({ day, events: [] });
      lastDay = day;
    }
    groups[groups.length - 1].events.push(e);
  }

  // Dynamic subtitle from date range
  const now = new Date();
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const subtitle = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <Panel style={{ height: "100%" }} selected={selected}>
      <PanelHeader
        icon={<Calendar size={30} color="#FFFFFF" />}
        label="Calendar"
        subtitle={subtitle}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          flex: 1,
          overflowY: "auto",
        }}
      >
        {loading && (
          <div style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66", padding: "12px 0", textAlign: "center" }}>
            Loading calendar…
          </div>
        )}
        {error && (
          <div style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66", padding: 8 }}>
            {error}
          </div>
        )}
        {!loading &&
          groups.map((g, gi) => (
            <div key={gi} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{
                  fontFamily: F,
                  fontSize: 14,
                  fontWeight: 600,
                  color: g.day === "Today" ? "#FFFFFF" : "#FFFFFF88",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginTop: gi > 0 ? 8 : 0,
                }}
              >
                {g.day}
              </div>
              {g.events.map((e, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 5,
                    border: "1px solid #FFFFFF30",
                  }}
                >
                  <span
                    style={{
                      fontFamily: M,
                      fontSize: 19.5,
                      fontWeight: 600,
                      color: "#FFFFFF",
                      flexShrink: 0,
                    }}
                  >
                    {e.time}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <span style={{ fontFamily: F, fontSize: 19.5, fontWeight: 500, color: "#FFFFFF" }}>
                      {e.title}
                    </span>
                    {(e.sub || e.who) && (
                      <span style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66" }}>
                        {e.sub || e.who}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        {!loading && items.length === 0 && (
          <div style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66", textAlign: "center", padding: "20px 0" }}>
            No upcoming events
          </div>
        )}
      </div>
    </Panel>
  );
}
