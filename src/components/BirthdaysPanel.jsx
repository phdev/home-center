import { Cake, Check, AlarmClock, Sparkles } from "lucide-react";
import { Panel, PanelHeader } from "./Panel";
import { BIRTHDAYS } from "../data/mockData";

const F = "'Geist','Inter',system-ui,sans-serif";

const GIFT_PILL = {
  ready: { bg: "#4ADE8020", stroke: "#4ADE8060", fg: "#4ADE80", Icon: Check, label: "Gift ready" },
  ordered: { bg: "#4ADE8020", stroke: "#4ADE8060", fg: "#4ADE80", Icon: Check, label: "Ordered" },
  needed: { bg: "#F59E0B25", stroke: "#F59E0B80", fg: "#F59E0B", Icon: AlarmClock, label: "Order soon" },
  unknown: { bg: "#60A5FA20", stroke: "#60A5FA60", fg: "#60A5FA", Icon: Sparkles, label: "Find ideas" },
};

export function BirthdaysPanel({ birthdays, loading, error, selected, derived }) {
  const items = birthdays && birthdays.length > 0 ? birthdays : BIRTHDAYS;
  const giftStatusById = new Map(
    (derived?.birthdaysRanked ?? []).map((b) => [b.id, b.giftStatus]),
  );

  return (
    <Panel style={{ height: "100%" }} selected={selected}>
      <PanelHeader
        icon={<Cake size={30} color="#FFFFFF" />}
        label="Birthdays"
      />
      {loading && (
        <div style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66", textAlign: "center", padding: "8px 0" }}>
          Loading birthdays…
        </div>
      )}
      {error && (
        <div style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66", padding: 8 }}>
          {error}
        </div>
      )}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        {!loading && items.map((b, i) => {
          const status = giftStatusById.get(b.id) ?? b.giftStatus ?? "unknown";
          const pill = GIFT_PILL[status] ?? GIFT_PILL.unknown;
          const Ico = pill.Icon;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "#FFFFFF15",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  flexShrink: 0,
                }}
              >
                {b.avatar}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
                <span style={{ fontFamily: F, fontSize: 19.5, fontWeight: 500, color: "#FFFFFF" }}>
                  {b.name}
                </span>
                <span style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66" }}>
                  {b.date} — {b.daysUntil} day{b.daysUntil !== 1 ? "s" : ""}{b.daysUntil <= 10 ? "!" : ""}
                </span>
              </div>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: pill.bg,
                  border: `1px solid ${pill.stroke}`,
                  flexShrink: 0,
                }}
              >
                <Ico size={14} color={pill.fg} />
                <span style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: pill.fg }}>
                  {pill.label}
                </span>
              </span>
            </div>
          );
        })}
        {!loading && items.length === 0 && (
          <div style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66", textAlign: "center", padding: "12px 0" }}>
            No upcoming birthdays
          </div>
        )}
      </div>
    </Panel>
  );
}
