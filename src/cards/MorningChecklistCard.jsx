import { useState } from "react";
import { Sun, Bot, Check } from "lucide-react";
import { Panel, PanelHeader } from "../components/Panel";

const F = "'Geist','Inter',system-ui,sans-serif";

/**
 * Weekday AM checklist. Items, counts, and the weather variant come from
 * derived state — this component does not compute any of that.
 *
 * `enhanced.intro` may override the default opener if OpenClaw returned one.
 */
export function MorningChecklistCard({ derived, enhanced = {}, selected }) {
  const [done, setDone] = useState(new Set());
  const items = derived.checklist?.items ?? [];
  const intro = enhanced.intro ?? defaultIntro(derived.checklist.variant);

  const toggle = (id) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Panel selected={selected}>
      <PanelHeader
        icon={<Sun size={24} color="#F59E0B" />}
        label="Before You Head Out"
      />
      <div style={introStyle}>
        <Bot size={16} color="#60A5FA" style={{ flexShrink: 0, marginTop: 2 }} />
        <span style={{ color: "#FFFFFFCC", fontFamily: F, fontSize: 13, lineHeight: 1.4 }}>
          {intro}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10, flex: 1 }}>
        {items.map((it) => {
          const isDone = done.has(it.id);
          return (
            <button
              key={it.id}
              onClick={() => toggle(it.id)}
              style={{
                ...itemStyle,
                background: isDone ? "#4ADE8012" : "transparent",
                borderColor: isDone ? "#4ADE8050" : "#FFFFFF30",
              }}
            >
              <span
                style={{
                  ...boxStyle,
                  background: isDone ? "#4ADE80" : "transparent",
                  borderColor: isDone ? "#4ADE80" : "#FFFFFF50",
                }}
              >
                {isDone && <Check size={13} color="#0A0A0A" strokeWidth={3} />}
              </span>
              <span
                style={{
                  fontFamily: F,
                  fontSize: 15,
                  color: isDone ? "#FFFFFFAA" : "#FFFFFF",
                  textAlign: "left",
                }}
              >
                {it.label}
                {it.conditionReason && (
                  <span style={{ color: "#F59E0BCC", marginLeft: 6, fontSize: 12 }}>
                    · {it.conditionReason}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function defaultIntro(variant) {
  if (variant?.hotDay) return `Quick check — ${variant.highTempF}° today, shorts weather.`;
  if (variant?.needsJacket) return `Quick check — chilly out, grab a jacket.`;
  if (variant?.rain) return `Quick check — rain likely, umbrellas up.`;
  return `Quick check before heading out.`;
}

const introStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: 7,
  padding: "8px 10px",
  borderRadius: 8,
  background: "#60A5FA10",
};

const itemStyle = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid",
  background: "transparent",
  cursor: "pointer",
  textAlign: "left",
};

const boxStyle = {
  width: 18,
  height: 18,
  borderRadius: 4,
  border: "2px solid",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};
