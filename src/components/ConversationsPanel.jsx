import { useState } from "react";
import { Panel, PanelHeader } from "./Panel";
import { CONVOS } from "../data/mockData";

export function ConversationsPanel({ t }) {
  const [expanded, setExpanded] = useState(null);

  return (
    <Panel t={t} style={{ height: "100%" }}>
      <PanelHeader t={t} icon={"\u{1F4AC}"} label="Recent Chats" />
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 5,
        }}
      >
        {CONVOS.map((c, i) => (
          <div
            key={i}
            onClick={() => setExpanded(expanded === i ? null : i)}
            style={{
              padding: "7px 9px",
              borderRadius: t.radius / 2.5,
              background: expanded === i ? `${t.accent}10` : `${t.text}04`,
              border: `1px solid ${expanded === i ? t.accent + "20" : t.panelBorder}`,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: "1.15rem" }}>{c.av}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: t.bodyFont,
                    fontSize: "0.78rem",
                    fontWeight: 500,
                    color: t.text,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {c.q}
                </div>
                <div
                  style={{
                    fontFamily: t.bodyFont,
                    fontSize: "0.58rem",
                    color: t.textDim,
                  }}
                >
                  {c.who} · {c.ts}
                </div>
              </div>
            </div>
            {expanded === i && (
              <div
                style={{
                  marginTop: 6,
                  padding: "6px 8px",
                  borderRadius: t.radius / 3,
                  background: `${t.accent}08`,
                  border: `1px solid ${t.accent}15`,
                }}
              >
                <div
                  style={{
                    fontFamily: t.bodyFont,
                    fontSize: "0.72rem",
                    color: t.textMuted,
                    lineHeight: 1.5,
                  }}
                >
                  {c.a}
                </div>
                <button
                  style={{
                    marginTop: 4,
                    fontFamily: t.bodyFont,
                    fontSize: "0.6rem",
                    color: t.accent,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Continue →
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}
