import { Mic, MicOff } from "lucide-react";

const pulseKeyframes = `
@keyframes recording-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
`;

export function RecordingIndicator({ active, type, count }) {
  const sessionCount = count || 0;
  const mode = type === "negative" ? "−" : "+";

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
          background: active ? "#EF444420" : "#FFFFFF10",
          border: `1px solid ${active ? "#EF4444" : "#FFFFFF30"}`,
        }}
      >
        {/* Listening indicator */}
        {active ? (
          <>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#EF4444",
                boxShadow: "0 0 8px #EF444480",
                animation: "recording-pulse 1s ease-in-out infinite",
              }}
            />
            <Mic size={16} color="#EF4444" />
            <span
              style={{
                fontFamily: "'Geist','Inter',system-ui,sans-serif",
                fontSize: 13,
                fontWeight: 600,
                color: "#EF4444",
                whiteSpace: "nowrap",
              }}
            >
              {mode} Recording
            </span>
          </>
        ) : (
          <>
            <MicOff size={16} color="#FFFFFF55" />
            <span
              style={{
                fontFamily: "'Geist','Inter',system-ui,sans-serif",
                fontSize: 13,
                color: "#FFFFFF55",
                whiteSpace: "nowrap",
              }}
            >
              Recorder idle
            </span>
          </>
        )}

        {/* Divider */}
        <div style={{ width: 1, height: 16, background: "#FFFFFF30" }} />

        {/* Current session count only. Legacy saved-sample totals are not shown here
            because the production Vosk path no longer uses the old 50/50 target. */}
        <span
          style={{
            fontFamily: "'JetBrains Mono',ui-monospace,monospace",
            fontSize: 13,
            color: active ? "#EF4444" : "#FFFFFF99",
            whiteSpace: "nowrap",
          }}
        >
          {mode}{sessionCount}
        </span>
      </div>
    </>
  );
}
