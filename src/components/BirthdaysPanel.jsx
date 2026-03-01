import { Cake } from "lucide-react";
import { Panel, PanelHeader } from "./Panel";
import { BIRTHDAYS } from "../data/mockData";

const F = "'Geist','Inter',system-ui,sans-serif";

export function BirthdaysPanel({ birthdays, loading, error, selected }) {
  const items = birthdays && birthdays.length > 0 ? birthdays : BIRTHDAYS;

  return (
    <Panel style={{ height: "100%" }} selected={selected}>
      <PanelHeader
        icon={<Cake size={30} color="#FFFFFF" />}
        label="Birthdays"
      />
      {loading && (
        <div style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66", textAlign: "center", padding: "8px 0" }}>
          Loading birthdays…
        </div>
      )}
      {error && (
        <div style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66", padding: 8 }}>
          {error}
        </div>
      )}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        {!loading && items.map((b, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#FFFFFF15",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                flexShrink: 0,
              }}
            >
              {b.avatar}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontFamily: F, fontSize: 19.5, fontWeight: 500, color: "#FFFFFF" }}>
                {b.name}
              </span>
              <span style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66" }}>
                {b.date} — {b.daysUntil} day{b.daysUntil !== 1 ? "s" : ""}{b.daysUntil <= 10 ? "!" : ""}
              </span>
            </div>
          </div>
        ))}
        {!loading && items.length === 0 && (
          <div style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66", textAlign: "center", padding: "12px 0" }}>
            No upcoming birthdays
          </div>
        )}
      </div>
    </Panel>
  );
}
