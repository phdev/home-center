import { AlertCircle, CheckCircle2, ImageOff, TriangleAlert } from "lucide-react";

const COPY = {
  knowledge: {
    color: "#F59E0B",
    soft: "rgba(245, 158, 11, 0.16)",
    title: "Marked that answer wrong",
    saving: "Saving feedback on the last knowledge answer.",
    captured: "Feedback captured. I will treat that answer as unreliable.",
    not_attached: "I heard the correction, but there was no recent answer to attach it to.",
    failed: "I heard the correction, but the feedback save failed.",
    icon: TriangleAlert,
  },
  image: {
    color: "#22D3EE",
    soft: "rgba(34, 211, 238, 0.15)",
    title: "Marked that picture wrong",
    saving: "Saving image feedback separately from the answer text.",
    captured: "Image feedback captured. I will avoid relying on that picture.",
    not_attached: "I heard the correction, but there was no recent picture to attach it to.",
    failed: "I heard the correction, but the image feedback save failed.",
    icon: ImageOff,
  },
};

export function KnowledgeFeedbackOverlay({ ack }) {
  if (!ack) return null;
  const config = COPY[ack.kind] || COPY.knowledge;
  const Icon = config.icon;
  const isFailed = ack.status === "failed";
  const StatusIcon = ack.status === "captured" ? CheckCircle2 : isFailed ? AlertCircle : null;
  const detail = config[ack.status] || config.saving;

  return (
    <>
      <style>{`
        @keyframes knowledgeFeedbackIn {
          from { opacity: 0; transform: scale(0.985); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes knowledgeFeedbackPulse {
          0%, 100% { opacity: 0.78; }
          50% { opacity: 1; }
        }
      `}</style>
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10020,
          pointerEvents: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `radial-gradient(circle at 50% 52%, ${config.soft} 0%, rgba(3,7,18,0.82) 48%, rgba(3,7,18,0.92) 100%)`,
          boxShadow: `inset 0 0 0 2px ${config.color}55, inset 0 0 90px ${config.color}33`,
          animation: "knowledgeFeedbackIn 0.22s ease-out",
        }}
      >
        <div
          style={{
            width: "min(920px, 78vw)",
            minHeight: 330,
            borderRadius: 8,
            padding: "42px 54px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 22,
            background: "rgba(8, 13, 28, 0.96)",
            border: `2px solid ${config.color}AA`,
            boxShadow: `0 24px 90px rgba(0,0,0,0.62), 0 0 52px ${config.color}33`,
            fontFamily: "'Geist','Inter',system-ui,sans-serif",
            color: "#FFFFFF",
          }}
        >
          <Icon size={72} color={config.color} strokeWidth={2.1} />
          <div style={{ fontSize: 42, fontWeight: 760, textAlign: "center", lineHeight: 1.1 }}>
            {config.title}
          </div>
          <div
            style={{
              maxWidth: 720,
              fontSize: 22,
              lineHeight: 1.38,
              textAlign: "center",
              color: "rgba(255,255,255,0.78)",
            }}
          >
            {detail}
          </div>
          <div
            style={{
              marginTop: 8,
              height: 42,
              padding: "0 18px",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              background: config.soft,
              border: `1px solid ${config.color}55`,
              color: isFailed ? "#FCA5A5" : config.color,
              fontFamily: "'JetBrains Mono',ui-monospace,monospace",
              fontSize: 14,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0,
              animation: ack.status === "saving" ? "knowledgeFeedbackPulse 1s ease-in-out infinite" : "none",
            }}
          >
            {StatusIcon && <StatusIcon size={18} />}
            {ack.status === "saving" ? "Saving" : ack.status === "captured" ? "Feedback captured" : "Feedback noted"}
          </div>
        </div>
      </div>
    </>
  );
}
