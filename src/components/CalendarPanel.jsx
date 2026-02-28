import { Calendar } from "lucide-react";
import { Panel, PanelHeader } from "./Panel";
import { CALENDAR } from "../data/mockData";

const F = "'Geist','Inter',system-ui,sans-serif";
const M = "'JetBrains Mono',ui-monospace,monospace";

export function CalendarPanel({ t, events, loading, error }) {
  const items = events || CALENDAR;

  return (
    <Panel style={{ height: "100%" }}>
      <PanelHeader
        icon={<Calendar size={30} color="#FFFFFF" />}
        label="Calendar"
        subtitle="February 2026"
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
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
          items.map((e, i) => (
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
                <span style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66" }}>
                  {e.sub || e.who || ""}
                </span>
              </div>
            </div>
          ))}
        {!loading && items.length === 0 && (
          <div style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66", textAlign: "center", padding: "20px 0" }}>
            No events today
          </div>
        )}
      </div>
    </Panel>
  );
}
