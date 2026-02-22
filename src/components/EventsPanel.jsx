import { useState } from "react";
import { Panel, PanelHeader } from "./Panel";
import { EVENTS } from "../data/mockData";

export function EventsPanel({ t }) {
  const [selected, setSelected] = useState(null);

  return (
    <Panel t={t} style={{ height: "100%" }}>
      <PanelHeader t={t} icon={"\u{1F389}"} label="Nearby Events" />
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {EVENTS.map((e, i) => (
          <div
            key={i}
            onClick={() => setSelected(selected === i ? null : i)}
            style={{
              padding: "8px 10px",
              borderRadius: t.radius / 2,
              background: selected === i ? `${t.text}06` : `${t.text}02`,
              border: `1px solid ${t.panelBorder}`,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: t.radius / 2.5,
                  background: `${t.id === "terminal" ? t.accent : e.c}12`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.15rem",
                  flexShrink: 0,
                }}
              >
                {e.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: t.bodyFont,
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    color: t.text,
                  }}
                >
                  {e.title}
                </div>
                <div
                  style={{
                    fontFamily: t.bodyFont,
                    fontSize: "0.6rem",
                    color: t.textDim,
                  }}
                >
                  {e.when}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div
                  style={{
                    fontFamily: t.bodyFont,
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    color: e.price === "Free" ? t.accent2 : t.textMuted,
                  }}
                >
                  {e.price}
                </div>
                <div
                  style={{
                    fontFamily: t.bodyFont,
                    fontSize: "0.55rem",
                    color: t.textDim,
                  }}
                >
                  {e.dist}
                </div>
              </div>
            </div>
            {selected === i && (
              <div
                style={{
                  marginTop: 6,
                  padding: "5px 8px",
                  borderRadius: t.radius / 3,
                  background: `${t.id === "terminal" ? t.accent : e.c}08`,
                }}
              >
                <div
                  style={{
                    fontFamily: t.bodyFont,
                    fontSize: "0.7rem",
                    color: t.textMuted,
                    lineHeight: 1.4,
                  }}
                >
                  {e.desc}
                </div>
                <div
                  style={{
                    fontFamily: t.bodyFont,
                    fontSize: "0.58rem",
                    color: t.textDim,
                    marginTop: 4,
                  }}
                >
                  {"\u{1F4CD}"} {e.where}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}
