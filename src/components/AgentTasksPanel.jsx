import { Bot } from "lucide-react";
import { Panel, PanelHeader } from "./Panel";
import { TASKS } from "../data/mockData";

const F = "'Geist','Inter',system-ui,sans-serif";
const M = "'JetBrains Mono',ui-monospace,monospace";

export function AgentTasksPanel({ t, selected }) {
  const activeCount = TASKS.filter((tk) => tk.status === "active").length;

  return (
    <Panel style={{ height: "100%" }} selected={selected}>
      <PanelHeader
        icon={<Bot size={30} color="#FFFFFF" />}
        label="OpenClaw"
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#FFFFFF",
              }}
            />
            <span style={{ fontFamily: F, fontSize: 16.5, fontWeight: 500, color: "#FFFFFF88" }}>
              {activeCount} active
            </span>
          </div>
        }
      />
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {TASKS.map((tk, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              borderRadius: 5,
              border: "1px solid #FFFFFF30",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
              <span style={{ fontFamily: F, fontSize: 19.5, fontWeight: 500, color: "#FFFFFF" }}>
                {tk.title}
              </span>
              <span style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66" }}>
                {tk.detail}
              </span>
            </div>
            <span
              style={{
                fontFamily: M,
                fontSize: 15,
                fontWeight: 600,
                color: "#FFFFFF88",
                padding: "4px 10px",
                borderRadius: 999,
                background: "#FFFFFF15",
                border: "1px solid #FFFFFF40",
                flexShrink: 0,
                marginLeft: 10,
              }}
            >
              {tk.status === "done" ? "Done" : "Running"}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
