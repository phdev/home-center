import {
  Bot,
  AlertTriangle,
  CalendarClock,
  Gift,
  Utensils,
  Sandwich,
  Moon,
  ChevronRight,
} from "lucide-react";
import { Panel, PanelHeader } from "../components/Panel";

const F = "'Geist','Inter',system-ui,sans-serif";

const ICONS = {
  moon: Moon,
  "alert-triangle": AlertTriangle,
  "calendar-clock": CalendarClock,
  gift: Gift,
  utensils: Utensils,
  sandwich: Sandwich,
};

const ACCENTS = {
  red: { bg: "#EF444410", stroke: "#EF444450", tile: "#EF4444", ico: "#FFFFFF" },
  amber: { bg: "#F59E0B10", stroke: "#F59E0B50", tile: "#F59E0B", ico: "#0A0A0A" },
  blue: { bg: "#60A5FA10", stroke: "#60A5FA50", tile: "#60A5FA", ico: "#0A0A0A" },
  green: { bg: "#4ADE8010", stroke: "#4ADE8050", tile: "#4ADE80", ico: "#0A0A0A" },
  neutral: { bg: "transparent", stroke: "#FFFFFF30", tile: "#FFFFFF15", ico: "#FFFFFF" },
};

/**
 * Reads the already-ranked suggestions from derived state. OpenClaw may have
 * replaced `title`/`detail` via the `enhanced.items` field, matched by id.
 */
export function ClawSuggestionsCard({ derived, enhanced = {}, selected, onAction }) {
  const base = derived.clawSuggestions;
  const enhancedById = new Map((enhanced.items ?? []).map((i) => [i.id, i]));

  return (
    <Panel selected={selected}>
      <PanelHeader
        icon={<Bot size={24} color="#60A5FA" />}
        label="Claw Suggestions"
        right={
          <span style={badgeStyle}>{base.length}</span>
        }
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        {base.map((s) => {
          const e = enhancedById.get(s.id);
          const title = e?.title ?? s.title;
          const detail = e?.detail ?? s.detail;
          const Ico = ICONS[s.iconName] ?? Bot;
          const palette = ACCENTS[s.accent] ?? ACCENTS.neutral;
          return (
            <button
              key={s.id}
              onClick={() => onAction?.(s)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                background: palette.bg,
                border: `1px solid ${palette.stroke}`,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: palette.tile,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Ico size={15} color={palette.ico} />
              </span>
              <span style={{ flex: 1 }}>
                <span
                  style={{
                    display: "block",
                    fontFamily: F,
                    fontSize: 14,
                    color: "#FFFFFF",
                    fontWeight: 600,
                  }}
                >
                  {title}
                </span>
                <span style={{ display: "block", fontFamily: F, fontSize: 12, color: "#FFFFFFAA" }}>
                  {detail}
                </span>
              </span>
              <ChevronRight size={16} color="#FFFFFF88" />
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

const badgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 22,
  height: 22,
  borderRadius: 999,
  background: "#60A5FA",
  color: "#0A0A0A",
  fontFamily: "'JetBrains Mono',ui-monospace,monospace",
  fontSize: 12,
  fontWeight: 700,
};
