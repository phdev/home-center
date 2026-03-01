import { Timer } from "lucide-react";
import { Panel, PanelHeader } from "./Panel";
import { formatTime } from "../utils/formatTime";

const F = "'Geist','Inter',system-ui,sans-serif";
const M = "'JetBrains Mono',ui-monospace,monospace";

export function TimersPanel({ t, timers, dismissTimer }) {
  return (
    <Panel style={{ height: "100%" }}>
      <PanelHeader
        icon={<Timer size={30} color="#FFFFFF" />}
        label="Timers"
        subtitle={`"Hey Homer, set a timer..."`}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, overflow: "auto" }}>
        {timers.length === 0 && (
          <div style={{ color: "#FFFFFF40", fontSize: 16, fontFamily: F, textAlign: "center", marginTop: 24 }}>
            No active timers
          </div>
        )}
        {timers.map((tm) => (
          <div
            key={tm.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              borderRadius: 5,
              border: tm.expired
                ? "2px solid #FF6B6B"
                : "1px solid #FFFFFF30",
              background: tm.expired ? "#FF6B6B15" : "transparent",
              cursor: tm.expired ? "pointer" : "default",
            }}
            onClick={tm.expired ? () => dismissTimer(tm.id) : undefined}
          >
            <span style={{ fontFamily: F, fontSize: 19.5, fontWeight: 500, color: "#FFFFFF" }}>
              {tm.name}
            </span>
            <span
              style={{
                fontFamily: M,
                fontSize: 33,
                fontWeight: 700,
                color: tm.expired ? "#FF6B6B" : "#FFFFFF",
              }}
            >
              {tm.expired ? "DONE" : formatTime(tm.remaining)}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
