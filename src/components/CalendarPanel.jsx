import { Panel, PanelHeader } from "./Panel";
import { CALENDAR } from "../data/mockData";

export function CalendarPanel({ t, events, loading, error }) {
  const items = events || CALENDAR;
  const showMock = !events;

  return (
    <Panel t={t}>
      <PanelHeader
        t={t}
        icon={"📅"}
        label="Today"
        right={
          showMock && (
            <span
              style={{
                fontFamily: t.bodyFont,
                fontSize: "0.5rem",
                color: t.textDim,
                textTransform: "none",
                letterSpacing: 0,
              }}
            >
              demo
            </span>
          )
        }
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 5,
          flex: 1,
          overflowY: "auto",
        }}
      >
        {loading && (
          <div
            style={{
              fontFamily: t.bodyFont,
              fontSize: "0.75rem",
              color: t.textDim,
              padding: "12px 0",
              textAlign: "center",
            }}
          >
            Loading calendar…
          </div>
        )}
        {error && (
          <div
            style={{
              fontFamily: t.bodyFont,
              fontSize: "0.7rem",
              color: t.warm,
              padding: "8px",
              background: `${t.warm}10`,
              borderRadius: t.radius / 3,
            }}
          >
            {error}
          </div>
        )}
        {!loading &&
          items.map((e, i) => (
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
        {!loading && items.length === 0 && (
          <div
            style={{
              fontFamily: t.bodyFont,
              fontSize: "0.75rem",
              color: t.textDim,
              textAlign: "center",
              padding: "20px 0",
            }}
          >
            No events today
          </div>
        )}
      </div>
    </Panel>
  );
}
