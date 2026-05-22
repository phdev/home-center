import { Panel, PanelHeader } from "./Panel";

const CATEGORY_COLORS = {
  school: "#FF6B6B",
  medical: "#E74C3C",
  activities: "#4ECDC4",
  household: "#FFE66D",
  travel: "#3498DB",
  family_events: "#9B59B6",
  deliveries: "#FF8A5C",
  government: "#6BCB77",
  finance: "#F39C12",
};

function timeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationsPanel({ t, notifications, loading, error, onDismiss }) {
  const items = notifications || [];

  return (
    <Panel t={t} style={{ height: "100%" }}>
      <PanelHeader
        t={t}
        icon={"📬"}
        label="Email Triage"
        right={
          items.length > 0 && (
            <span
              style={{
                fontFamily: t.bodyFont,
                fontSize: "0.6rem",
                fontWeight: 700,
                color: t.panelBg,
                background: t.accent,
                borderRadius: 8,
                padding: "1px 6px",
                minWidth: 16,
                textAlign: "center",
              }}
            >
              {items.length}
            </span>
          )
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
            Loading notifications...
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
        {!loading && items.length === 0 && (
          <div
            style={{
              fontFamily: t.bodyFont,
              fontSize: "0.75rem",
              color: t.textDim,
              textAlign: "center",
              padding: "20px 0",
              lineHeight: 1.5,
            }}
          >
            No notifications
          </div>
        )}
        {!loading &&
          items.map((n) => {
            const catColor = CATEGORY_COLORS[n.category] || t.accent;
            return (
              <div
                key={n.id}
                style={{
                  padding: "8px 10px",
                  borderRadius: t.radius / 2,
                  background: `${t.text}04`,
                  border: `1px solid ${t.panelBorder}`,
                  borderLeft: `3px solid ${t.id === "terminal" ? t.accent : catColor}`,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 3,
                  }}
                >
                  <span style={{ fontSize: "0.9rem", lineHeight: 1 }}>
                    {n.icon || "📧"}
                  </span>
                  <span
                    style={{
                      fontFamily: t.bodyFont,
                      fontSize: "0.55rem",
                      fontWeight: 600,
                      color: t.id === "terminal" ? t.accent : catColor,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {(n.category || "").replace("_", " ")}
                  </span>
                  <span
                    style={{
                      fontFamily: t.bodyFont,
                      fontSize: "0.5rem",
                      color: t.textDim,
                      marginLeft: "auto",
                    }}
                  >
                    {n.timestamp ? timeAgo(n.timestamp) : ""}
                  </span>
                  {onDismiss && (
                    <button
                      onClick={() => onDismiss(n.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: t.textDim,
                        cursor: "pointer",
                        fontSize: "0.7rem",
                        padding: "0 2px",
                        lineHeight: 1,
                        opacity: 0.6,
                      }}
                    >
                      x
                    </button>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: t.bodyFont,
                    fontSize: "0.78rem",
                    fontWeight: 500,
                    color: t.text,
                    lineHeight: 1.35,
                    marginBottom: 2,
                  }}
                >
                  {n.title}
                </div>
                {n.from && (
                  <div
                    style={{
                      fontFamily: t.bodyFont,
                      fontSize: "0.6rem",
                      color: t.textDim,
                    }}
                  >
                    from {n.from}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </Panel>
  );
}
