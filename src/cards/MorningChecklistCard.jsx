import { Sun, Bot, AlertTriangle } from "lucide-react";
import { Panel, PanelHeader } from "../components/Panel";

const F = "'Geist','Inter',system-ui,sans-serif";

/**
 * Weekday AM checklist. Items, counts, and the weather variant come from
 * derived state — this component does not compute any of that.
 *
 * `enhanced.intro` may override the default opener if OpenClaw returned one.
 */
export function MorningChecklistCard({ derived, enhanced = {}, selected }) {
  const items = derived.checklist?.items ?? [];
  const intro = enhanced.intro ?? defaultIntro(derived.checklist.variant);
  const risk = peterRiskLine(derived);

  return (
    <Panel selected={selected} style={{ height: "100%" }}>
      <PanelHeader
        icon={<Sun size={24} color="#F59E0B" />}
        label="Morning Runway"
      />
      <div style={introStyle}>
        <Bot size={16} color="#60A5FA" style={{ flexShrink: 0, marginTop: 2 }} />
        <span style={{ color: "#FFFFFFCC", fontFamily: F, fontSize: 13, lineHeight: 1.4 }}>
          {intro}
        </span>
      </div>
      {risk && (
        <div style={riskStyle}>
          <AlertTriangle size={18} color="#F59E0B" style={{ flexShrink: 0 }} />
          <span style={{ fontFamily: F, fontSize: 15, color: "#FFE8B5", lineHeight: 1.35 }}>
            {risk}
          </span>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10, flex: 1 }}>
        {items.map((it) => {
          return (
            <div
              key={it.id}
              style={itemStyle}
            >
              <span style={dotStyle} />
              <span
                style={{
                  fontFamily: F,
                  fontSize: 15,
                  color: "#FFFFFF",
                  textAlign: "left",
                  lineHeight: 1.3,
                }}
              >
                {it.label}
                {it.conditionReason && (
                  <span style={{ color: "#F59E0BCC", marginLeft: 6, fontSize: 12 }}>
                    · {it.conditionReason}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function defaultIntro(variant) {
  if (variant?.hotDay) return `Warm morning: keep the exit simple.`;
  if (variant?.needsJacket) return `Chilly morning: jacket check before leaving.`;
  if (variant?.rain) return `Rain likely: umbrellas by the door.`;
  return `Clear the morning path before heading out.`;
}

function peterRiskLine(derived) {
  if (!derived?.peter0800_0900Risk) return "";
  const event = derived.peter0800_0900Events?.[0];
  if (!event?.title) return "Peter has an 8-9 work block risk.";
  return `Peter 8-9 risk: ${event.title}`;
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
  border: "1px solid #FFFFFF30",
  background: "transparent",
  textAlign: "left",
};

const dotStyle = {
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: "#F59E0B",
  flexShrink: 0,
};

const riskStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginTop: 10,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #F59E0B55",
  background: "#F59E0B14",
};
