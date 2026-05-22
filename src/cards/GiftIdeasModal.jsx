import { useEffect, useState } from "react";
import { Gift, X, Bot } from "lucide-react";
import { enhance } from "../ai/openclaw";

const F = "'Geist','Inter',system-ui,sans-serif";

/**
 * Full-screen gift-ideas panel triggered from a Claw Suggestions row
 * (`actionKind === 'orderGift'`). Fetches `/api/claw/enhance` with
 * `feature: 'birthdayGiftIdeas'` on mount; renders the returned
 * `ideas[]` once they arrive, or a deterministic fallback line if
 * OpenClaw is unreachable.
 *
 * Visibility is fully controlled by the parent — pass `open` + `onClose`.
 * This component never reads `DerivedState`; it's a leaf view of a single
 * suggestion's context.
 */
export function GiftIdeasModal({
  open,
  onClose,
  birthday,
  workerSettings,
}) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !birthday) return;
    let cancelled = false;
    setLoading(true);
    setResult(null);
    enhance(
      {
        feature: "birthdayGiftIdeas",
        state: {
          name: birthday.name,
          relation: birthday.relation ?? "",
          daysUntil: birthday.daysUntil,
        },
      },
      workerSettings,
    ).then((r) => {
      if (cancelled) return;
      setResult(r);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, birthday?.id, birthday?.name, workerSettings?.url]);

  if (!open || !birthday) return null;

  const ideas = result?.fields?.ideas ?? [];
  const empty = !loading && ideas.length === 0;

  return (
    <div
      role="dialog"
      aria-label={`Gift ideas for ${birthday.name}`}
      onClick={onClose}
      style={backdropStyle}
    >
      <div onClick={(e) => e.stopPropagation()} style={panelStyle}>
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={iconWrapStyle}>
              <Gift size={22} color="#0A0A0A" />
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={titleStyle}>Gift ideas for {birthday.name}</span>
              <span style={subtitleStyle}>
                {birthday.daysUntil === 0
                  ? "Today"
                  : `In ${birthday.daysUntil} day${birthday.daysUntil === 1 ? "" : "s"}`}
                {birthday.relation ? ` · ${birthday.relation}` : ""}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={closeBtnStyle}
          >
            <X size={18} color="#FFFFFF" />
          </button>
        </div>

        {loading && <div style={statusLineStyle}>Thinking…</div>}

        {!loading && empty && (
          <div style={{ ...introStyle, marginTop: 12 }}>
            <Bot size={16} color="#60A5FA" style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ color: "#FFFFFFCC", fontFamily: F, fontSize: 13, lineHeight: 1.4 }}>
              Couldn't reach OpenClaw right now. Try again in a moment — the
              card still works without it, this view just needs the live call.
            </span>
          </div>
        )}

        {!loading && ideas.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
            {ideas.map((it, i) => (
              <div key={i} style={ideaCardStyle}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={ideaTitleStyle}>{it.idea}</span>
                  {it.priceEstimate && (
                    <span style={pricePillStyle}>{it.priceEstimate}</span>
                  )}
                </div>
                {it.rationale && (
                  <span style={rationaleStyle}>{it.rationale}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const backdropStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  backdropFilter: "blur(6px)",
  zIndex: 100,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 40,
};

const panelStyle = {
  width: "min(640px, 100%)",
  maxHeight: "min(780px, calc(100vh - 80px))",
  overflowY: "auto",
  background: "#0A0A0A",
  border: "1px solid #FFFFFF30",
  borderRadius: 16,
  padding: "20px 24px",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const headerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const iconWrapStyle = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: "#F59E0B",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const titleStyle = {
  fontFamily: F,
  fontSize: 18,
  fontWeight: 600,
  color: "#FFFFFF",
};

const subtitleStyle = {
  fontFamily: F,
  fontSize: 13,
  color: "#FFFFFF88",
};

const closeBtnStyle = {
  background: "transparent",
  border: "1px solid #FFFFFF30",
  borderRadius: 8,
  padding: 6,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const statusLineStyle = {
  fontFamily: F,
  fontSize: 13,
  color: "#FFFFFF88",
  padding: "20px 0",
  textAlign: "center",
};

const introStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 10,
  background: "#60A5FA10",
};

const ideaCardStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #FFFFFF30",
  background: "transparent",
};

const ideaTitleStyle = {
  fontFamily: F,
  fontSize: 16,
  fontWeight: 600,
  color: "#FFFFFF",
};

const pricePillStyle = {
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 999,
  background: "#4ADE8020",
  color: "#4ADE80",
  fontFamily: F,
  fontSize: 12,
  fontWeight: 600,
};

const rationaleStyle = {
  fontFamily: F,
  fontSize: 13,
  color: "#FFFFFFAA",
  lineHeight: 1.4,
};
