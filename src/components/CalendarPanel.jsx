import { Calendar, TriangleAlert } from "lucide-react";
import { Panel, PanelHeader } from "./Panel";
import { CALENDAR } from "../data/mockData";
import { useEnhancement } from "../ai/openclaw";
import { useSettings } from "../hooks/useSettings";

const F = "'Geist','Inter',system-ui,sans-serif";
const M = "'JetBrains Mono',ui-monospace,monospace";

function dedup(events) {
  const seen = new Set();
  return events.filter((e) => {
    const key = `${e.time}|${e.title.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function CalendarPanel({ t, events, loading, error, selected, derived }) {
  const items = dedup(events || CALENDAR);
  const { settings } = useSettings();

  // Only request enhancement when there's something to summarize — avoids a
  // wasted round-trip + a useless cache entry when the banner is hidden.
  const conflictState = derived?.hasMorningOverlap || derived?.peter0800_0900Risk
    ? {
        conflicts: (derived.conflicts ?? []).map((c) => ({
          a: { title: c.a?.title, start: c.a?.start },
          b: { title: c.b?.title, start: c.b?.start },
          at: c.at,
        })),
        peter0800_0900Risk: !!derived.peter0800_0900Risk,
      }
    : null;
  const enhancement = useEnhancement(
    "calendarConflict",
    conflictState,
    settings?.worker,
    { enabled: !!conflictState },
  );
  const conflictBanner = buildConflictBanner(derived, enhancement?.fields);

  // Group events by day label
  const groups = [];
  let lastDay = null;
  for (const e of items) {
    const day = e.day || "Today";
    if (day !== lastDay) {
      groups.push({ day, events: [] });
      lastDay = day;
    }
    groups[groups.length - 1].events.push(e);
  }

  // Dynamic subtitle from date range
  const now = new Date();
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const subtitle = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <Panel style={{ height: "100%" }} selected={selected}>
      <PanelHeader
        icon={<Calendar size={30} color="#FFFFFF" />}
        label="Calendar"
        subtitle={subtitle}
      />
      {conflictBanner && (
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
        >
          <TriangleAlert size={16} color="#F59E0B" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: "#F59E0B" }}>
              {conflictBanner.title}
            </span>
            <span style={{ fontFamily: F, fontSize: 12, color: "#FFFFFFCC", lineHeight: 1.35 }}>
              {conflictBanner.detail}
            </span>
          </div>
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          flex: 1,
          overflowY: "auto",
        }}
      >
        {loading && (
          <div style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66", padding: "12px 0", textAlign: "center" }}>
            Loading calendar…
          </div>
        )}
        {error && (
          <div style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66", padding: 8 }}>
            {error}
          </div>
        )}
        {!loading &&
          groups.map((g, gi) => (
            <div key={gi} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{
                  fontFamily: F,
                  fontSize: 14,
                  fontWeight: 600,
                  color: g.day === "Today" ? "#FFFFFF" : "#FFFFFF88",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginTop: gi > 0 ? 8 : 0,
                }}
              >
                {g.day}
              </div>
              {g.events.map((e, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 5,
                    border: "1px solid #FFFFFF30",
                  }}
                >
                  <span
                    style={{
                      fontFamily: M,
                      fontSize: 19.5,
                      fontWeight: 600,
                      color: "#FFFFFF",
                      flexShrink: 0,
                    }}
                  >
                    {e.time}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <span style={{ fontFamily: F, fontSize: 19.5, fontWeight: 500, color: "#FFFFFF" }}>
                      {e.title}
                    </span>
                    {(e.sub || e.who) && (
                      <span style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66" }}>
                        {e.sub || e.who}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        {!loading && items.length === 0 && (
          <div style={{ fontFamily: F, fontSize: 16.5, color: "#FFFFFF66", textAlign: "center", padding: "20px 0" }}>
            No upcoming events
          </div>
        )}
      </div>
    </Panel>
  );
}

function buildConflictBanner(derived, enhanced) {
  if (!derived) return null;
  if (!derived.hasMorningOverlap && !derived.peter0800_0900Risk) return null;

  // Deterministic baseline — always available, works with OpenClaw offline.
  let title;
  let detail;
  if (derived.hasMorningOverlap && derived.conflicts[0]) {
    const c = derived.conflicts[0];
    const t = new Date(c.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    title = `Heads up — ${t} overlap`;
    detail = `${c.a.title} and ${c.b.title} both at ${t}.${
      derived.peter0800_0900Risk ? " Peter: watch your 8–9 block." : ""
    }`;
  } else {
    title = "Watch the 8–9 block";
    detail = "You've got something scheduled 8–9 on a weekday.";
  }

  // OpenClaw-enhanced copy (optional — takes over title/detail when present).
  if (enhanced?.summary) title = enhanced.summary;
  if (enhanced?.suggestion) detail = enhanced.suggestion;

  return { title, detail };
}
