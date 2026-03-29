import { useState, useEffect, useCallback } from "react";
import { Mic, MicOff, X, ChevronUp, ChevronDown, Trash2, Sliders } from "lucide-react";
import { apiUrl, apiHeaders } from "../services/piLocal";

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

const PARAM_DEFS = [
  { key: "detection_threshold", label: "Detection Threshold", min: 0.1, max: 0.9, step: 0.05 },
  { key: "min_consecutive", label: "Min Consecutive Frames", min: 1, max: 10, step: 1 },
  { key: "min_rms_energy", label: "Min RMS Energy", min: 50, max: 1000, step: 25 },
  { key: "score_smooth_window", label: "Score Smooth Window", min: 1, max: 10, step: 1 },
  { key: "post_action_mute", label: "Post-Action Mute (s)", min: 1, max: 30, step: 1 },
  { key: "high_confidence_bypass", label: "High Confidence Bypass", min: 0.5, max: 1.0, step: 0.05 },
  { key: "cooldown_seconds", label: "Cooldown (s)", min: 1, max: 30, step: 1 },
  { key: "record_seconds", label: "Record Duration (s)", min: 1, max: 8, step: 0.5 },
  { key: "verify_buffer_seconds", label: "Verify Buffer (s)", min: 1, max: 5, step: 0.5 },
];

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

function ParamSlider({ def, value, onChange }) {
  const displayVal = Number.isInteger(def.step) ? value : value.toFixed(2);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
      <span style={{
        fontFamily: M, fontSize: 11, color: "#FFFFFF88",
        width: 170, flexShrink: 0,
      }}>
        {def.label}
      </span>
      <input
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        onChange={(e) => onChange(def.key, parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: "#60A5FA", height: 4 }}
      />
      <span style={{
        fontFamily: M, fontSize: 11, color: "#60A5FA",
        width: 50, textAlign: "right", flexShrink: 0,
      }}>
        {displayVal}
      </span>
    </div>
  );
}

export function WakeWordDebug({ events, connected, onClear, workerUrl, workerToken }) {
  const [expanded, setExpanded] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);

  // Fetch config when config panel is shown
  useEffect(() => {
    if (!showConfig) return;
    const url = apiUrl(workerUrl, "/api/wake-config");
    if (!url) return;
    fetch(url, { headers: apiHeaders(workerToken) })
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {});
  }, [showConfig, workerUrl, workerToken]);

  const updateParam = useCallback((key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  const saveConfig = useCallback(async () => {
    const url = apiUrl(workerUrl, "/api/wake-config");
    if (!url || !config) return;
    setSaving(true);
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: apiHeaders(workerToken),
        body: JSON.stringify(config),
      });
      if (res.ok) {
        const updated = await res.json();
        setConfig(updated);
      }
    } catch {
      // silent
    }
    setSaving(false);
  }, [workerUrl, workerToken, config]);

  if (minimized) {
    return (
      <div
        onClick={() => setMinimized(false)}
        style={{
          position: "fixed", bottom: 16, left: 16, zIndex: 9999,
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
      position: "fixed", bottom: 16, left: 16, zIndex: 9999,
      width: expanded ? 500 : 360,
      maxHeight: expanded ? "35vh" : 120,
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
            onClick={() => setShowConfig(!showConfig)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
            title="Tune parameters"
          >
            <Sliders size={14} color={showConfig ? "#60A5FA" : "#FFFFFF44"} />
          </button>
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

      {/* Config Panel */}
      {showConfig && config && (
        <div style={{
          padding: "10px 14px", borderBottom: "1px solid #FFFFFF15",
          background: "#0D0D0D", maxHeight: 280, overflowY: "auto",
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: 8,
          }}>
            <span style={{ fontFamily: F, fontSize: 12, fontWeight: 600, color: "#FFFFFF88" }}>
              TUNABLE PARAMETERS
            </span>
            <button
              onClick={saveConfig}
              disabled={saving}
              style={{
                fontFamily: M, fontSize: 11, fontWeight: 600,
                color: saving ? "#FFFFFF44" : "#60A5FA",
                background: "#60A5FA15", border: "1px solid #60A5FA30",
                borderRadius: 6, padding: "4px 12px", cursor: "pointer",
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
          {PARAM_DEFS.map((def) => (
            <ParamSlider
              key={def.key}
              def={def}
              value={config[def.key] ?? 0}
              onChange={updateParam}
            />
          ))}
        </div>
      )}

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
