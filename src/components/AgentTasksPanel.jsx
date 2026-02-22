import { Panel, PanelHeader } from "./Panel";
import { TASKS } from "../data/mockData";

export function AgentTasksPanel({ t }) {
  const statusColors = { active: t.accent, waiting: t.warm, done: t.accent2 };

  return (
    <Panel t={t} style={{ height: "100%" }}>
      <PanelHeader t={t} icon={"\u{1F916}"} label="Agent Tasks" />
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 7,
        }}
      >
        {TASKS.map((tk, i) => (
          <div
            key={i}
            style={{
              padding: "8px 10px",
              borderRadius: t.radius / 2,
              background: `${t.text}04`,
              border: `1px solid ${t.panelBorder}`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: "1.2rem" }}>{tk.icon}</span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: t.bodyFont,
                    fontSize: "0.82rem",
                    fontWeight: 500,
                    color: t.text,
                  }}
                >
                  {tk.title}
                </div>
                <div
                  style={{
                    fontFamily: t.bodyFont,
                    fontSize: "0.55rem",
                    color: t.textDim,
                  }}
                >
                  {tk.agent} Agent
                </div>
              </div>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: statusColors[tk.status],
                  boxShadow: `0 0 6px ${statusColors[tk.status]}50`,
                }}
              />
            </div>
            <div
              style={{
                fontFamily: t.bodyFont,
                fontSize: "0.68rem",
                color: t.textMuted,
                lineHeight: 1.4,
              }}
            >
              {tk.detail}
            </div>
            {tk.prog && (
              <div
                style={{
                  height: 3,
                  borderRadius: 2,
                  background: `${t.text}08`,
                  marginTop: 6,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${tk.prog}%`,
                    borderRadius: 2,
                    background: statusColors[tk.status],
                  }}
                />
              </div>
            )}
            {tk.opts && (
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  marginTop: 6,
                  flexWrap: "wrap",
                }}
              >
                {tk.opts.map((o, oi) => (
                  <button
                    key={oi}
                    style={{
                      fontFamily: t.bodyFont,
                      fontSize: "0.62rem",
                      padding: "3px 8px",
                      borderRadius: t.radius / 3,
                      background: `${t.text}06`,
                      border: `1px solid ${t.panelBorder}`,
                      color: t.textMuted,
                      cursor: "pointer",
                    }}
                  >
                    {o}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}
