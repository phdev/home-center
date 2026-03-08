import { useState } from "react";
import { Mic, MicOff, X, ChevronUp, ChevronDown, Trash2 } from "lucide-react";

const M = "'JetBrains Mono',ui-monospace,monospace";
const F = "'Geist','Inter',system-ui,sans-serif";

const TYPE_COLORS = {
  dnn_score: "#FACC15",
  wake_candidate: "#FB923C",
  whisper_verify: "#4ADE80",
  whisper_fail: "#EF4444",
  command: "#60A5FA",
  error: "#EF4444",
};

const TYPE_LABELS = {
  dnn_score: "DNN",
  wake_candidate: "WAKE",
  whisper_verify: "VERIFIED",
  whisper_fail: "REJECTED",
  command: "CMD",
  error: "ERR",
};

function formatTime(ts) {
  const d = new Date(ts);
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function EventRow({ event }) {
  const color = TYPE_COLORS[event.type] || "#FFFFFF66";
  const label = TYPE_LABELS[event.type] || event.type;

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 8,
      padding: "4px 0", borderBottom: "1px solid #FFFFFF08",
    }}>
      <span style={{
        fontFamily: M, fontSize: 11, color: "#FFFFFF44",
        width: 60, flexShrink: 0,
      }}>
        {formatTime(event.timestamp)}
      </span>
      <span style={{
        fontFamily: M, fontSize: 10, fontWeight: 700,
        color, textTransform: "uppercase",
        width: 70, flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: M, fontSize: 11, color: "#FFFFFFCC",
        flex: 1, wordBreak: "break-word",
      }}>
        {event.message || ""}
        {event.score != null && ` (${(event.score * 100).toFixed(0)}%)`}
        {event.action && ` → ${event.action}`}
        {event.transcript && ` "${event.transcript}"`}
      </span>
    </div>
  );
}

export function WakeWordDebug({ events, connected, onClear }) {
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(false);

  if (minimized) {
    return (
      <div
        onClick={() => setMinimized(false)}
        style={{
          position: "fixed", bottom: 16, right: 16, zIndex: 9999,
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 14px", borderRadius: 12, cursor: "pointer",
          background: "#111", border: `1px solid ${connected ? "#4ADE8044" : "#FFFFFF22"}`,
        }}
      >
        {connected ? <Mic size={16} color="#4ADE80" /> : <MicOff size={16} color="#FFFFFF44" />}
        <span style={{ fontFamily: M, fontSize: 12, color: connected ? "#4ADE80" : "#FFFFFF44" }}>
          Wake Word {events.length > 0 ? `(${events.length})` : ""}
        </span>
        <ChevronUp size={14} color="#FFFFFF44" />
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed", bottom: 16, right: 16, zIndex: 9999,
      width: expanded ? 500 : 360,
      maxHeight: expanded ? "60vh" : 240,
      background: "#0A0A0A", border: "1px solid #FFFFFF20",
      borderRadius: 12, overflow: "hidden",
      display: "flex", flexDirection: "column",
      boxShadow: "0 8px 32px #00000088",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", borderBottom: "1px solid #FFFFFF15",
        background: "#111",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {connected ? <Mic size={16} color="#4ADE80" /> : <MicOff size={16} color="#EF4444" />}
          <span style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color: "#FFF" }}>
            Wake Word Debug
          </span>
          <span style={{ fontFamily: M, fontSize: 11, color: "#FFFFFF44" }}>
            {events.length} events
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={onClear}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
            title="Clear events"
          >
            <Trash2 size={14} color="#FFFFFF44" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronDown size={14} color="#FFFFFF44" /> : <ChevronUp size={14} color="#FFFFFF44" />}
          </button>
          <button
            onClick={() => setMinimized(true)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
            title="Minimize"
          >
            <X size={14} color="#FFFFFF44" />
          </button>
        </div>
      </div>

      {/* Events */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "8px 14px",
      }}>
        {events.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", height: "100%", gap: 8, padding: 20,
          }}>
            <MicOff size={24} color="#FFFFFF22" />
            <span style={{ fontFamily: F, fontSize: 13, color: "#FFFFFF33" }}>
              {connected ? "Listening... no events yet" : "Wake word service not connected"}
            </span>
          </div>
        ) : (
          [...events].reverse().map((e, i) => (
            <EventRow key={`${e.timestamp}-${e.type}-${i}`} event={e} />
          ))
        )}
      </div>
    </div>
  );
}
