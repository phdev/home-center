import { Bot } from "lucide-react";
import { Panel, PanelHeader } from "./Panel";
import { TASKS as MOCK_TASKS } from "../data/mockData";

const F = "'Geist','Inter',system-ui,sans-serif";
const M = "'JetBrains Mono',ui-monospace,monospace";

export function AgentTasksPanel({ t, selected, tasks: liveTasks }) {
  // Use live tasks from worker, fall back to mock data
  const tasks = liveTasks && liveTasks.length > 0 ? liveTasks : MOCK_TASKS;
  const activeCount = tasks.filter((tk) => tk.status === "active").length;

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
                background: activeCount > 0 ? "#4ade80" : "#FFFFFF",
              }}
            />
            <span style={{ fontFamily: F, fontSize: 16.5, fontWeight: 500, color: "#FFFFFF88" }}>
              {activeCount} active
            </span>
          </div>
        }
      />
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {tasks.map((tk, i) => (
          <div
            key={tk.id || i}
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
              {tk.source && tk.source !== "openclaw" && (
                <span style={{ fontFamily: M, fontSize: 12, color: "#FFFFFF33", marginTop: 2 }}>
                  via {tk.source}
                </span>
              )}
            </div>
            <span
              style={{
                fontFamily: M,
                fontSize: 15,
                fontWeight: 600,
                color: tk.status === "done" ? "#4ade80" : "#FFFFFF88",
                padding: "4px 10px",
                borderRadius: 999,
                background: tk.status === "done" ? "#4ade8015" : "#FFFFFF15",
                border: `1px solid ${tk.status === "done" ? "#4ade8040" : "#FFFFFF40"}`,
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
