import { Mail } from "lucide-react";
import { Panel, PanelHeader } from "./Panel";
import { SCHOOL_UPDATES } from "../data/mockData";

const F = "'Geist','Inter',system-ui,sans-serif";
const M = "'JetBrains Mono',ui-monospace,monospace";

export function EventsPanel({ updates, loading, error }) {
  const items = updates && updates.length > 0 ? updates : SCHOOL_UPDATES;

  return (
    <Panel style={{ height: "100%" }}>
      <PanelHeader
        icon={<Mail size={30} color="#FFFFFF" />}
        label="School Updates"
        right={
          <div
            style={{
              width: 25,
              height: 25,
              borderRadius: "50%",
              background: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: F,
              fontSize: 14,
              fontWeight: 700,
              color: "#000000",
            }}
          >
            {items.length}
          </div>
        }
      />
      {loading && (
        <div style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66", textAlign: "center", padding: "8px 0" }}>
          Loading updates…
        </div>
      )}
      {error && (
        <div style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66", padding: 8 }}>
          {error}
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {!loading && items.map((u, i) => (
          <div
            key={i}
            style={{
              padding: "10px 14px",
              borderRadius: 5,
              border: "1px solid #FFFFFF30",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontFamily: M, fontSize: 15, fontWeight: 600, color: "#FFFFFF" }}>
                {u.label}
              </span>
              <span style={{ fontFamily: F, fontSize: 15, color: "#FFFFFF44" }}>
                {u.date}
              </span>
            </div>
            <span style={{ fontFamily: F, fontSize: 19.5, fontWeight: 500, color: "#FFFFFF" }}>
              {u.title}
            </span>
            <span style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66" }}>
              {u.desc}
            </span>
          </div>
        ))}
        {!loading && items.length === 0 && (
          <div style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66", textAlign: "center", padding: "12px 0" }}>
            No school updates
          </div>
        )}
      </div>
    </Panel>
  );
}
