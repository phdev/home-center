import { Mic } from "lucide-react";

const pulseKeyframes = `
@keyframes recording-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.08); }
}
`;

export function RecordingIndicator({ active, type, count }) {
  if (!active) return null;

  const isPositive = type === "positive";

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
          REC {isPositive ? "+" : "−"} {count}
        </span>
      </div>
    </>
  );
}
