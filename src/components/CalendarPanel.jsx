import { Panel, PanelHeader } from "./Panel";
import { CALENDAR } from "../data/mockData";

export function CalendarPanel({ t }) {
  return (
    <Panel t={t}>
      <PanelHeader t={t} icon={"\u{1F4C5}"} label="Today" />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 5,
          flex: 1,
          overflowY: "auto",
        }}
      >
        {CALENDAR.map((e, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px",
              borderRadius: t.radius / 2.5,
              background: `${t.text}06`,
              borderLeft: `3px solid ${t.id === "terminal" ? t.accent : e.c}`,
            }}
          >
            <span
              style={{
                fontFamily: t.bodyFont,
                fontSize: "0.75rem",
                fontWeight: 600,
                color: t.id === "terminal" ? t.accent : e.c,
                minWidth: 60,
              }}
            >
              {e.time}
            </span>
            <div>
              <div
                style={{
                  fontFamily: t.bodyFont,
                  fontSize: "0.82rem",
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
                {e.who}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
