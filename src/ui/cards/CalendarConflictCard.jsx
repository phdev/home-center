import { TriangleAlert } from "lucide-react";

const F = "'Geist','Inter',system-ui,sans-serif";

export function CalendarConflictCard({ card }) {
  if (!card) return null;
  const content = buildConflictContent(card);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 8,
        background: "#F59E0B15",
        border: "1px solid #F59E0B60",
        marginBottom: 8,
      }}
      data-testid="calendar-conflict-card"
    >
      <TriangleAlert size={16} color="#F59E0B" style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: "#F59E0B" }}>
          {content.title}
        </span>
        <span style={{ fontFamily: F, fontSize: 12, color: "#FFFFFFCC", lineHeight: 1.35 }}>
          {content.detail}
        </span>
      </div>
    </div>
  );
}

function buildConflictContent(card) {
  const conflict = card.data?.conflicts?.[0];
  let title;
  let detail;

  if (conflict) {
    const time = new Date(conflict.at).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    title = `Heads up - ${time} overlap`;
    detail = `${conflict.a.title} and ${conflict.b.title} both at ${time}.${
      card.data?.peter0800_0900Risk ? " Peter: watch your 8-9 block." : ""
    }`;
  } else {
    title = "Watch the 8-9 block";
    detail = "There is something scheduled during Peter's weekday work block.";
  }

  return {
    title: card.enhanced?.summary ?? title,
    detail: card.enhanced?.suggestion ?? detail,
  };
}
