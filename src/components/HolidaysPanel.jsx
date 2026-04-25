import { useMemo } from "react";
import { PartyPopper } from "lucide-react";
import { Panel, PanelHeader } from "./Panel";
import { getUpcomingHolidays } from "../data/holidays";

const F = "'Geist','Inter',system-ui,sans-serif";
const M = "'JetBrains Mono',ui-monospace,monospace";

export function HolidaysPanel({ now = new Date(), selected, max = 4, daysAhead = 60 }) {
  const holidays = useMemo(
    () => getUpcomingHolidays(now, { daysAhead, max }),
    [now, daysAhead, max],
  );

  return (
    <Panel style={{ height: "100%" }} selected={selected}>
      <PanelHeader
        icon={<PartyPopper size={26} color="#F59E0B" />}
        label="Upcoming Holidays"
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
        {holidays.length === 0 && (
          <span style={{ fontFamily: F, fontSize: 16, color: "#FFFFFF66", padding: "8px 0" }}>
            No upcoming holidays
          </span>
        )}
        {holidays.map((h) => (
          <div
            key={h.date}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid #FFFFFF20",
            }}
          >
            <div
              style={{
                width: 52,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                padding: "4px 0",
                borderRadius: 6,
                background: `${h.color}20`,
              }}
            >
              <span style={{ fontFamily: M, fontSize: 11, fontWeight: 600, color: h.color, letterSpacing: 0.5 }}>
                {h.label.split(" ")[0].toUpperCase()}
              </span>
              <span style={{ fontFamily: M, fontSize: 18, fontWeight: 700, color: "#FFF" }}>
                {h.label.split(" ")[1]}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
              <span style={{ fontFamily: F, fontSize: 17, fontWeight: 500, color: "#FFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {h.name}
              </span>
              <span style={{ fontFamily: F, fontSize: 14, color: "#FFFFFF66" }}>
                {h.daysUntil === 0 ? "today" : h.daysUntil === 1 ? "tomorrow" : `in ${h.daysUntil} days`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
