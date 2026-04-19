import { Utensils, Bot } from "lucide-react";
import { Panel, PanelHeader } from "../components/Panel";
import { useTakeoutWriter } from "../data/useTakeout";
import { useSettings } from "../hooks/useSettings";

const F = "'Geist','Inter',system-ui,sans-serif";

export function TakeoutCard({ derived, enhanced = {}, selected }) {
  const { settings } = useSettings();
  const write = useTakeoutWriter(settings?.worker);
  const state = derived.takeoutState;
  const suggested = enhanced.topPicks?.length
    ? enhanced.topPicks.map((p) => p.name ?? p)
    : state.suggestedVendors;

  const now = new Date();
  const hm = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <Panel selected={selected}>
      <PanelHeader
        icon={<Utensils size={24} color="#FFFFFF" />}
        label="Dinner Tonight"
        subtitle={hm}
      />
      <div style={introStyle}>
        <Bot size={16} color="#60A5FA" style={{ flexShrink: 0, marginTop: 2 }} />
        <span style={{ color: "#FFFFFFCC", fontFamily: F, fontSize: 13, lineHeight: 1.4 }}>
          {enhanced.intro ?? "No decision yet — pick one or cook tonight."}
        </span>
      </div>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {suggested.slice(0, 2).map((vendor) => (
          <button
            key={vendor}
            onClick={() => write({ date: todayKey(), decision: "takeout", vendor })}
            style={pickStyle}
          >
            <span style={{ fontFamily: F, fontSize: 15, fontWeight: 600, color: "#FFFFFF" }}>
              {vendor}
            </span>
            <span style={{ fontFamily: F, fontSize: 11, color: "#4ADE80" }}>suggested</span>
          </button>
        ))}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          {suggested.slice(2).map((v) => (
            <button
              key={v}
              onClick={() => write({ date: todayKey(), decision: "takeout", vendor: v })}
              style={chipStyle}
            >
              {v}
            </button>
          ))}
          <button
            onClick={() => write({ date: todayKey(), decision: "home" })}
            style={{ ...chipStyle, borderColor: "#FFFFFF60" }}
          >
            Cook tonight
          </button>
        </div>
      </div>
    </Panel>
  );
}

function todayKey() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

const introStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: 7,
  padding: "8px 10px",
  borderRadius: 8,
  background: "#60A5FA10",
};

const pickStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 2,
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #4ADE8070",
  background: "#4ADE8015",
  cursor: "pointer",
};

const chipStyle = {
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid #FFFFFF30",
  background: "transparent",
  color: "#FFFFFF",
  fontFamily: F,
  fontSize: 13,
  cursor: "pointer",
};
