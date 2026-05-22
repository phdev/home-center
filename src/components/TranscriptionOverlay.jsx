import { Mic } from "lucide-react";

const F = "'Geist','Inter',system-ui,sans-serif";
const M = "'JetBrains Mono',ui-monospace,monospace";

export function TranscriptionOverlay({ query, visible }) {
  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes llmPulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        @keyframes llmFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes llmDot {
          0%, 80%, 100% { opacity: 0.3; }
          40% { opacity: 1; }
        }
      `}</style>
      <div style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "#000000DD",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 24,
      }}>
        {/* Pulsing mic icon */}
        <div style={{
          width: 80, height: 80, borderRadius: 40,
          background: "#FFFFFF10", border: "1px solid #FFFFFF30",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "llmPulse 2s ease-in-out infinite",
        }}>
          <Mic size={36} color="#FFFFFF" />
        </div>

        {/* Query text */}
        {query && (
          <div style={{
            fontFamily: F, fontSize: 28, fontWeight: 600,
            color: "#FFFFFF", textAlign: "center",
            maxWidth: 700, lineHeight: 1.4,
            animation: "llmFadeIn 0.4s ease-out",
          }}>
            "{query}"
          </div>
        )}

        {/* Thinking indicator */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          animation: "llmFadeIn 0.6s ease-out",
        }}>
          <span style={{
            fontFamily: M, fontSize: 16, color: "#FFFFFF66",
            letterSpacing: 1,
          }}>
            Thinking
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: "50%",
                background: "#FFFFFF66",
                animation: `llmDot 1.4s ease-in-out infinite ${i * 0.2}s`,
              }} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
