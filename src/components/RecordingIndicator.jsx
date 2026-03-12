import { Mic } from "lucide-react";

const pulseKeyframes = `
@keyframes recording-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.08); }
}
`;

const GOAL = 50;

export function RecordingIndicator({ active, type, count, totalPositive, totalNegative }) {
  const hasAny = (totalPositive || 0) > 0 || (totalNegative || 0) > 0;

  // When not recording, show persistent totals (if any samples exist)
  if (!active) {
    if (!hasAny) return null;
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          borderRadius: 12,
          background: "#FFFFFF10",
          border: "1px solid #FFFFFF30",
        }}
      >
        <Mic size={16} color="#FFFFFF88" />
        <span
          style={{
            fontFamily: "'Geist','Inter',system-ui,sans-serif",
            fontSize: 13,
            color: "#FFFFFF88",
            whiteSpace: "nowrap",
          }}
        >
          {totalPositive || 0}+ {totalNegative || 0}−
        </span>
      </div>
    );
  }

  // Active recording
  const isPositive = type === "positive";
  const sessionTotal = isPositive
    ? (totalPositive || 0) + (count || 0)
    : (totalNegative || 0) + (count || 0);

  return (
    <>
      <style>{pulseKeyframes}</style>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          borderRadius: 12,
          background: "#EF444420",
          border: "1px solid #EF4444",
          animation: "recording-pulse 1.5s ease-in-out infinite",
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#EF4444",
            boxShadow: "0 0 8px #EF444480",
          }}
        />
        <Mic size={18} color="#EF4444" />
        <span
          style={{
            fontFamily: "'Geist','Inter',system-ui,sans-serif",
            fontSize: 14,
            fontWeight: 600,
            color: "#EF4444",
            whiteSpace: "nowrap",
          }}
        >
          {isPositive ? "+" : "−"}{count}
        </span>
        <span
          style={{
            fontFamily: "'Geist','Inter',system-ui,sans-serif",
            fontSize: 12,
            color: "#FFFFFF66",
            whiteSpace: "nowrap",
          }}
        >
          ({sessionTotal}/{GOAL})
        </span>
      </div>
    </>
  );
}
