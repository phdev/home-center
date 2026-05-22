import { Mail } from "lucide-react";
import { Panel, PanelHeader } from "../../components/Panel";

const F = "'Geist','Inter',system-ui,sans-serif";

const KIND_LABEL = {
  action: "ACTION",
  event: "EVENT",
  reminder: "REMINDER",
  info: "INFO",
};

const KIND_ACCENT = {
  action: { bg: "#EF4444", fg: "#FFFFFF" },
  event: { bg: "#60A5FA", fg: "#0A0A0A" },
  reminder: { bg: "#FFFFFF25", fg: "#FFFFFF" },
  info: { bg: "#FFFFFF15", fg: "#FFFFFFAA" },
};

export function SchoolUpdatesCard({ card, selected }) {
  const items = card?.data?.items ?? [];
  const urgent = !!card?.data?.urgent;
  const panelStyle = urgent
    ? { height: "100%", border: "1px solid #EF444470", background: "#EF444408" }
    : { height: "100%" };

  return (
    <Panel style={panelStyle} selected={selected}>
      <PanelHeader
        icon={<Mail size={30} color={urgent ? "#EF4444" : "#FFFFFF"} />}
        label="School Updates"
        right={
          <div
            style={{
              width: 25,
              height: 25,
              borderRadius: "50%",
              background: urgent ? "#EF4444" : "#FFFFFF",
              color: urgent ? "#FFFFFF" : "#000000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: F,
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {items.length}
          </div>
        }
      />
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {items.length === 0 && (
          <div
            style={{
              fontFamily: F,
              fontSize: 16.5,
              color: "#FFFFFF66",
              textAlign: "center",
              padding: "12px 0",
            }}
          >
            No school updates
          </div>
        )}
        {items.map((item) => {
          const accent = KIND_ACCENT[item.kind] ?? KIND_ACCENT.info;
          const dueLabel = formatDue(item);
          const childLabel = item.child ? ` - ${item.child}` : "";
          return (
            <div
              key={item.id}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: urgent && item.urgency >= 0.7
                  ? "1px solid #EF444470"
                  : "1px solid #FFFFFF30",
                background: urgent && item.urgency >= 0.7 ? "#EF444410" : "transparent",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
              data-testid={`school-item-${item.id}`}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: accent.bg,
                    color: accent.fg,
                    fontFamily: F,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                  }}
                >
                  {KIND_LABEL[item.kind] ?? "INFO"}
                </span>
                {dueLabel && (
                  <span
                    style={{
                      fontFamily: F,
                      fontSize: 13,
                      color: item.urgency >= 0.7 ? "#EF4444" : "#FFFFFFAA",
                      fontWeight: 600,
                    }}
                  >
                    {dueLabel}{childLabel}
                  </span>
                )}
              </div>
              <span style={{ fontFamily: F, fontSize: 18, fontWeight: 500, color: "#FFFFFF" }}>
                {item.title}
              </span>
              {item.summary && (
                <span style={{ fontFamily: F, fontSize: 15, color: "#FFFFFF88" }}>
                  {item.enhanced?.summary ?? item.summary}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function formatDue(item) {
  const iso = item.dueDate ?? item.eventDate ?? item.date;
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
