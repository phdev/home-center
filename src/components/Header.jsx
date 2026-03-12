import { LayoutDashboard, Mic, Clock } from "lucide-react";
import { GlassesIndicator } from "./GlassesIndicator";
import { GestureDebug } from "./GestureDebug";
import { RecordingIndicator } from "./RecordingIndicator";

export function Header({ now, isMobile, onHistory, handControllerConnected, lastGesture, wakeRecord }) {
  const time = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const date = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  if (isMobile) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LayoutDashboard size={30} color="#FFFFFF" />
          <span
            style={{
              fontFamily: "'Geist','Inter',system-ui,sans-serif",
              fontSize: 24,
              fontWeight: 700,
              color: "#FFFFFF",
            }}
          >
            The Howell Hub
          </span>
        </div>
        <span
          style={{
            fontFamily: "'JetBrains Mono',ui-monospace,monospace",
            fontSize: 28,
            fontWeight: 600,
            color: "#FFFFFF",
          }}
        >
          {time}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        height: 70,
        padding: "0 24px",
        borderBottom: "1px solid #FFFFFF30",
        flexShrink: 0,
      }}
    >
      {/* Left: Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <LayoutDashboard size={36} color="#FFFFFF" />
        <span
          style={{
            fontFamily: "'Geist','Inter',system-ui,sans-serif",
            fontSize: 33,
            fontWeight: 700,
            color: "#FFFFFF",
          }}
        >
          The Howell Hub
        </span>
      </div>

      {/* Center: Voice + History */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Mic size={30} color="#FFFFFF" />
        <span
          style={{
            fontFamily: "'Geist','Inter',system-ui,sans-serif",
            fontSize: 21,
            color: "#FFFFFF66",
          }}
        >
          "Hey Dashboard..."
        </span>
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "#FFFFFF",
          }}
        />
        {onHistory && (
          <div
            onClick={onHistory}
            style={{
              marginLeft: 12,
              width: 36,
              height: 36,
              borderRadius: 18,
              background: "#FFFFFF10",
              border: "1px solid #FFFFFF20",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Clock size={18} color="#FFFFFF88" />
          </div>
        )}
      </div>

      {/* Right: Debug + Glasses + Date + Clock */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <RecordingIndicator active={wakeRecord?.active} type={wakeRecord?.type} count={wakeRecord?.count} />
        <GestureDebug lastGesture={lastGesture} />
        <GlassesIndicator connected={handControllerConnected} />
        <span
          style={{
            fontFamily: "'Geist','Inter',system-ui,sans-serif",
            fontSize: 22.5,
            color: "#FFFFFF88",
          }}
        >
          {date}
        </span>
        <span
          style={{
            fontFamily: "'JetBrains Mono',ui-monospace,monospace",
            fontSize: 42,
            fontWeight: 600,
            color: "#FFFFFF",
          }}
        >
          {time}
        </span>
      </div>
    </div>
  );
}
