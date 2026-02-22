import { Panel, PanelHeader } from "./Panel";
import { BIRTHDAYS } from "../data/mockData";

export function BirthdaysPanel({ t }) {
  const giftColor = (g) => {
    if (g === "Opened!" || g === "Delivered") return t.accent2;
    if (g === "Shipped") return t.accent;
    if (g === "Need to buy") return t.warm;
    return t.accent3;
  };

  const upcoming = BIRTHDAYS.filter((b) => !b.passed);
  const past = BIRTHDAYS.filter((b) => b.passed);

  return (
    <Panel t={t} style={{ height: "100%" }}>
      <PanelHeader
        t={t}
        icon={"\u{1F382}"}
        label="Feb Birthdays"
        right={
          <span
            style={{
              fontFamily: t.bodyFont,
              fontSize: "0.6rem",
              padding: "2px 8px",
              borderRadius: 10,
              background: `${t.warm}15`,
              color: t.warm,
              fontWeight: 600,
            }}
          >
            {upcoming.length} upcoming
          </span>
        }
      />
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {upcoming.length > 0 && (
          <>
            {upcoming.map((b, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 12px",
                  borderRadius: t.radius / 2,
                  background: i === 0 ? `${t.warm}08` : `${t.text}04`,
                  border: `1px solid ${i === 0 ? t.warm + "20" : t.panelBorder}`,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {i === 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      background: `${t.warm}20`,
                      padding: "4px 12px",
                      borderRadius: `0 0 0 ${t.radius / 2}px`,
                      fontFamily: t.bodyFont,
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      color: t.warm,
                    }}
                  >
                    {b.daysUntil === 1
                      ? "\u{1F389} TOMORROW!"
                      : `${b.daysUntil} days`}
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: "50%",
                      background: `${b.c}15`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.5rem",
                      flexShrink: 0,
                      border: i === 0 ? `2px solid ${t.warm}40` : "none",
                    }}
                  >
                    {b.avatar}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontFamily: t.bodyFont,
                        fontSize: "0.88rem",
                        fontWeight: 600,
                        color: t.text,
                      }}
                    >
                      {b.name}
                    </div>
                    <div
                      style={{
                        fontFamily: t.bodyFont,
                        fontSize: "0.65rem",
                        color: t.textDim,
                      }}
                    >
                      {b.date} · Turning {b.age}
                      {i > 0 ? ` · ${b.daysUntil}d` : ""}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: t.bodyFont,
                      fontSize: "0.6rem",
                      padding: "2px 8px",
                      borderRadius: 8,
                      background: `${giftColor(b.gift)}15`,
                      color: giftColor(b.gift),
                      fontWeight: 600,
                    }}
                  >
                    {b.gift}
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 6,
                    padding: "5px 8px",
                    borderRadius: t.radius / 3,
                    background: `${t.text}04`,
                  }}
                >
                  <div
                    style={{
                      fontFamily: t.bodyFont,
                      fontSize: "0.68rem",
                      color: t.textMuted,
                    }}
                  >
                    {"\u{1F381}"} {b.giftIdea}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
        {past.length > 0 && (
          <>
            <div
              style={{
                fontFamily: t.bodyFont,
                fontSize: "0.55rem",
                color: t.textDim,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginTop: 4,
              }}
            >
              Earlier
            </div>
            {past.map((b, i) => (
              <div
                key={i}
                style={{
                  padding: "6px 8px",
                  borderRadius: t.radius / 2,
                  background: `${t.text}03`,
                  border: `1px solid ${t.panelBorder}`,
                  opacity: 0.65,
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: 7 }}
                >
                  <span style={{ fontSize: "1.1rem" }}>{b.avatar}</span>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontFamily: t.bodyFont,
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        color: t.text,
                      }}
                    >
                      {b.name}
                    </div>
                    <div
                      style={{
                        fontFamily: t.bodyFont,
                        fontSize: "0.55rem",
                        color: t.textDim,
                      }}
                    >
                      {b.date} · Turned {b.age}
                    </div>
                  </div>
                  <span
                    style={{
                      fontFamily: t.bodyFont,
                      fontSize: "0.55rem",
                      color: t.accent2,
                    }}
                  >
                    {"\u2713"} {b.gift}
                  </span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </Panel>
  );
}
