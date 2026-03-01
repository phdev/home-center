import { Timer } from "lucide-react";
import { Panel, PanelHeader } from "./Panel";
import { formatTime } from "../utils/formatTime";

const F = "'Geist','Inter',system-ui,sans-serif";
const M = "'JetBrains Mono',ui-monospace,monospace";

export function TimersPanel({ t, timers, togglePause }) {
  return (
    <Panel style={{ height: "100%" }}>
      <PanelHeader
        icon={<Timer size={30} color="#FFFFFF" />}
        label="Timers"
        subtitle={`"Set a timer..."`}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        {timers.map((tm) => (
          <div
            key={tm.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              borderRadius: 5,
              border: "1px solid #FFFFFF30",
              cursor: "pointer",
            }}
            onClick={() => togglePause(tm.id)}
          >
            <span style={{ fontFamily: F, fontSize: 19.5, fontWeight: 500, color: "#FFFFFF" }}>
              {tm.name}
            </span>
            <span style={{ fontFamily: M, fontSize: 33, fontWeight: 700, color: "#FFFFFF" }}>
              {formatTime(tm.remaining)}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
