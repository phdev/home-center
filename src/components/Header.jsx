import { LayoutDashboard, Mic, Clock, Settings } from "lucide-react";
import { GlassesIndicator } from "./GlassesIndicator";
import { GestureDebug } from "./GestureDebug";
import { RecordingIndicator } from "./RecordingIndicator";

export function Header({ now, isMobile, onHistory, handControllerConnected, lastGesture, wakeRecord, hideClock = false, designSystem = "v2" }) {
  const isV2 = designSystem === "v2";
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
          gap: 10,
          marginBottom: 10,
          flexShrink: 0,
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <LayoutDashboard size={28} color="#FFFFFF" style={{ flexShrink: 0 }} />
          <span
            style={{
              fontFamily: "'Geist','Inter',system-ui,sans-serif",
              fontSize: 22,
              fontWeight: 700,
              color: "#FFFFFF",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            The Howell Hub
          </span>
        </div>
        {!hideClock && (
          <span
            style={{
              fontFamily: "'JetBrains Mono',ui-monospace,monospace",
              fontSize: 24,
              fontWeight: 600,
              color: "#FFFFFF",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            {time}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        height: isV2 ? 58 : 70,
        padding: isV2 ? "0 6px" : "0 24px",
        borderBottom: isV2 ? "0" : "1px solid #FFFFFF30",
        flexShrink: 0,
      }}
    >
      {/* Left: Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <LayoutDashboard size={isV2 ? 26 : 36} color="#FFFFFF" />
        <span
          style={{
            fontFamily: "'Geist','Inter',system-ui,sans-serif",
            fontSize: isV2 ? 27 : 33,
            fontWeight: 700,
            color: "#FFFFFF",
          }}
        >
          The Howell Hub
        </span>
        {isV2 && (
          <span
            style={{
              fontFamily: "'Geist','Inter',system-ui,sans-serif",
              fontSize: 15,
              fontWeight: 600,
              color: "#FFFFFF9C",
            }}
          >
            Home Center
          </span>
        )}
      </div>

      {/* Center: Voice + History */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Mic size={isV2 ? 20 : 30} color="#FFFFFF" />
        <span
          style={{
            fontFamily: "'Geist','Inter',system-ui,sans-serif",
            fontSize: isV2 ? 16 : 21,
            color: "#FFFFFF66",
          }}
        >
          "Hey Homer..."
        </span>
        <div
          style={{
            width: isV2 ? 8 : 12,
            height: isV2 ? 8 : 12,
            borderRadius: "50%",
            background: "#FFFFFF",
          }}
        />
        {onHistory && !isV2 && (
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
        {!isV2 && <RecordingIndicator active={wakeRecord?.active} type={wakeRecord?.type} count={wakeRecord?.count} totalPositive={wakeRecord?.totalPositive} totalNegative={wakeRecord?.totalNegative} />}
        {!isV2 && <GestureDebug lastGesture={lastGesture} />}
        {!isV2 && <GlassesIndicator connected={handControllerConnected} />}
        {isV2 && <Settings size={16} color="#FFFFFFB0" />}
        {isV2 && <div style={{ width: 1, height: 22, background: "rgba(255,255,255,0.18)" }} />}
        <span
          style={{
            fontFamily: "'Geist','Inter',system-ui,sans-serif",
            fontSize: isV2 ? 15 : 22.5,
            color: "#FFFFFF88",
          }}
        >
          {date}
        </span>
        {!hideClock && (
          <span
            style={{
              fontFamily: "'JetBrains Mono',ui-monospace,monospace",
              fontSize: isV2 ? 28 : 42,
              fontWeight: 600,
              color: "#FFFFFF",
            }}
          >
            {time}
          </span>
        )}
      </div>
    </div>
  );
}
