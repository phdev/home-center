import { useState, useMemo } from "react";
import { Cake, Check, AlarmClock, Sparkles } from "lucide-react";
import { Panel, PanelHeader } from "./Panel";
import { BIRTHDAYS } from "../data/mockData";
import { useBirthdayGiftWriter, readGiftOverrides } from "../data/useBirthdayGift";
import { useSettings } from "../hooks/useSettings";

const F = "'Geist','Inter',system-ui,sans-serif";

const GIFT_PILL = {
  ready: { bg: "#4ADE8020", stroke: "#4ADE8060", fg: "#4ADE80", Icon: Check, label: "Gift ready" },
  ordered: { bg: "#4ADE8020", stroke: "#4ADE8060", fg: "#4ADE80", Icon: Check, label: "Ordered" },
  needed: { bg: "#F59E0B25", stroke: "#F59E0B80", fg: "#F59E0B", Icon: AlarmClock, label: "Order soon" },
  unknown: { bg: "#60A5FA20", stroke: "#60A5FA60", fg: "#60A5FA", Icon: Sparkles, label: "Find ideas" },
};

// Click cycles through the four states. Deterministic ordering so users can
// learn the pattern without reading instructions.
const NEXT_STATUS = {
  unknown: "needed",
  needed: "ordered",
  ordered: "ready",
  ready: "unknown",
};

export function BirthdaysPanel({ birthdays, loading, error, selected, derived }) {
  const items = birthdays && birthdays.length > 0 ? birthdays : BIRTHDAYS;
  const { settings } = useSettings();
  const writeGift = useBirthdayGiftWriter(settings?.worker);
  const [localOverrides, setLocalOverrides] = useState(() => readGiftOverrides());

  const giftStatusById = useMemo(() => {
    const m = new Map(
      (derived?.birthdaysRanked ?? []).map((b) => [b.id, b.giftStatus]),
    );
    // Optimistic: local overrides win until the upstream fetch refreshes.
    for (const [id, o] of Object.entries(localOverrides)) {
      m.set(id, o.giftStatus);
    }
    return m;
  }, [derived?.birthdaysRanked, localOverrides]);

  const handleCycle = async (b) => {
    const current = giftStatusById.get(b.id) ?? b.giftStatus ?? "unknown";
    const next = NEXT_STATUS[current] ?? "unknown";
    // Optimistic update: render the next state immediately.
    setLocalOverrides((prev) => ({
      ...prev,
      [b.id]: { giftStatus: next, updatedAt: new Date().toISOString() },
    }));
    try {
      await writeGift(b.id, { giftStatus: next });
    } catch {
      // Adapter already wrote localStorage on failure; next read will reconcile.
    }
  };

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
            <div key={b.id ?? i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
              <button
                onClick={() => handleCycle(b)}
                aria-label={`Cycle gift status for ${b.name}`}
                data-testid={`gift-pill-${b.id}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: pill.bg,
                  border: `1px solid ${pill.stroke}`,
                  cursor: "pointer",
                  flexShrink: 0,
                  font: "inherit",
                }}
              >
                <Ico size={14} color={pill.fg} />
                <span style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: pill.fg }}>
                  {pill.label}
                </span>
              </button>
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
