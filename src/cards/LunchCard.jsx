import { Sandwich, Bot } from "lucide-react";
import { Panel, PanelHeader } from "../components/Panel";
import { useLunchWriter } from "../data/useLunch";

const F = "'Geist','Inter',system-ui,sans-serif";

export function LunchCard({ derived, raw, enhanced = {}, selected }) {
  const write = useLunchWriter();
  const ctx = derived.lunchContext;
  if (!ctx) return null;

  const kids = (raw?.bedtime ?? []).map((b) => b.childId);
  const decisions = raw?.lunchDecisions?.[ctx.dateISO]?.perChild ?? {};

  const choose = (childId, choice) => write(ctx.dateISO, { child: childId, choice });

  return (
    <Panel selected={selected}>
      <PanelHeader
        icon={<Sandwich size={24} color="#FFFFFF" />}
        label="Tomorrow's Lunch"
        subtitle={ctx.dateLabel}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontFamily: F, fontSize: 11, color: "#FFFFFF66", fontWeight: 500 }}>
          School menu
        </span>
        <div style={menuStyle}>
          {ctx.menu.length === 0 ? (
            <span style={{ color: "#FFFFFF88", fontFamily: F, fontSize: 13 }}>
              Menu not loaded yet — check with school.
            </span>
          ) : (
            ctx.menu.map((m, i) => (
              <span key={i} style={{ color: "#FFFFFFDD", fontFamily: F, fontSize: 14 }}>
                • {m}
              </span>
            ))
          )}
        </div>
      </div>
      {enhanced.kidPreferenceHint && (
        <div style={{ ...introStyle, marginTop: 10 }}>
          <Bot size={14} color="#60A5FA" style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ color: "#FFFFFFCC", fontFamily: F, fontSize: 13, lineHeight: 1.4 }}>
            {enhanced.kidPreferenceHint}
          </span>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
        {kids.map((kid) => (
          <div key={kid} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontFamily: F,
                fontSize: 13,
                color: "#FFFFFFAA",
                width: 70,
                textTransform: "capitalize",
              }}
            >
              {kid}
            </span>
            <button
              style={{
                ...btnStyle,
                ...(decisions[kid] === "school" ? primaryStyle : {}),
              }}
              onClick={() => choose(kid, "school")}
            >
              School
            </button>
            <button
              style={{
                ...btnStyle,
                ...(decisions[kid] === "home" ? primaryStyle : {}),
              }}
              onClick={() => choose(kid, "home")}
            >
              Home
            </button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

const introStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: 7,
  padding: "8px 10px",
  borderRadius: 8,
  background: "#60A5FA10",
};

const menuStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  padding: "10px 12px",
  borderRadius: 10,
  background: "#FFFFFF08",
  border: "1px solid #FFFFFF30",
};

const btnStyle = {
  flex: 1,
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #FFFFFF40",
  background: "transparent",
  color: "#FFFFFF",
  fontFamily: F,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const primaryStyle = {
  background: "#FFFFFF",
  color: "#0A0A0A",
  borderColor: "#FFFFFF",
};
