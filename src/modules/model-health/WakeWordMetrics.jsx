const F = "'Geist','Inter',system-ui,sans-serif";
const M = "'JetBrains Mono',ui-monospace,monospace";

const EVENT_COLORS = {
  wake_confirmed: "#4ade80",
  dnn_score: "#60a5fa",
  command: "#4ECDC4",
  custom_wake: "#c084fc",
};

function MiniBar({ values, max, color = "#4ECDC4", height = 32 }) {
  if (!values || !values.length) return null;
  const m = max || Math.max(...values, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height }}>
      {values.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${Math.max(2, (v / m) * 100)}%`,
            background: v > 0 ? color : "rgba(255,255,255,0.03)",
            borderRadius: 2,
            minWidth: 2,
          }}
        />
      ))}
    </div>
  );
}

function StatBox({ value, label, color = "#FFF", sub }) {
  return (
    <div style={{ textAlign: "center", minWidth: 100 }}>
      <div style={{ fontFamily: M, fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontFamily: F, fontSize: 12, color: "#FFFFFF66", marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontFamily: M, fontSize: 11, color: "#FFFFFF44", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function EventRow({ event }) {
  const time = new Date(event.timestamp);
  const h = time.getHours().toString().padStart(2, "0");
  const m = time.getMinutes().toString().padStart(2, "0");
  const s = time.getSeconds().toString().padStart(2, "0");
  const color = EVENT_COLORS[event.type] || "#888";

  let detail = "";
  if (event.type === "dnn_score") {
    detail = `score: ${(event.data?.score || 0).toFixed(3)}  rms: ${event.data?.rms || 0}`;
  } else if (event.type === "wake_confirmed") {
    detail = `confirmed (score: ${(event.data?.score || 0).toFixed(3)})`;
  } else if (event.type === "command") {
    detail = event.data?.action || event.data?.details || "";
  } else if (event.type === "custom_wake") {
    detail = event.data?.wake_phrase || event.data?.name || "";
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "5px 0",
      borderBottom: "1px solid rgba(255,255,255,0.03)", fontSize: 13,
    }}>
      <span style={{ fontFamily: M, fontSize: 11, color: "#FFFFFF44", width: 60, flexShrink: 0 }}>
        {h}:{m}:{s}
      </span>
      <span style={{
        padding: "1px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
        background: `${color}18`, color,
      }}>
        {event.type.replace("_", " ")}
      </span>
      <span style={{ fontFamily: M, fontSize: 12, color: "#FFFFFF88", flex: 1 }}>{detail}</span>
    </div>
  );
}

export function WakeWordMetrics({ metrics }) {
  if (!metrics) {
    return (
      <div style={{ color: "#FFFFFF44", fontFamily: F, fontSize: 14, padding: 20 }}>
        No wake word data available. Connect to the Pi to see live detection metrics.
      </div>
    );
  }

  return (
    <div>
      {/* Stats row */}
      <div style={{ display: "flex", gap: 24, marginBottom: 24, flexWrap: "wrap", justifyContent: "space-around" }}>
        <StatBox value={metrics.detections24h} label="Detections (24h)" color="#4ade80" />
        <StatBox value={metrics.detectionsLastHour} label="Last Hour" color="#4ade80" />
        <StatBox value={metrics.commands24h} label="Commands" color="#4ECDC4" />
        <StatBox value={`${metrics.avgDnnScore.toFixed(2)}`} label="Avg DNN Score" color="#60a5fa" />
        <StatBox value={`${metrics.highConfidenceRate}%`} label="High Conf Rate" color="#fbbf24" sub="score ≥ 0.8" />
        <StatBox value={metrics.avgRmsEnergy} label="Avg RMS" color="#FFFFFF88" sub="noise floor" />
      </div>

      {/* Hourly detection chart */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: F, fontSize: 13, color: "#FFFFFF44", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Detections by Hour
        </div>
        <MiniBar values={metrics.hourlyDetections} color="#4ade80" height={48} />
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: M, fontSize: 9, color: "#FFFFFF33", marginTop: 4 }}>
          <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
        </div>
      </div>

      {/* False positive indicator */}
      {metrics.totalDnnTriggers > 0 && (
        <div style={{
          display: "flex", gap: 16, marginBottom: 24, padding: "12px 16px",
          background: "rgba(255,255,255,0.02)", borderRadius: 8,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: F, fontSize: 13, color: "#FFFFFF66", marginBottom: 4 }}>Detection Accuracy</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: M, fontSize: 22, fontWeight: 700, color: metrics.unconfirmedHighScores === 0 ? "#4ade80" : "#fbbf24" }}>
                {metrics.totalDnnTriggers > 0
                  ? Math.round(((metrics.totalDnnTriggers - metrics.unconfirmedHighScores) / metrics.totalDnnTriggers) * 100)
                  : 100}%
              </span>
              <span style={{ fontFamily: F, fontSize: 12, color: "#FFFFFF44" }}>
                {metrics.totalDnnTriggers - metrics.unconfirmedHighScores}/{metrics.totalDnnTriggers} confirmed
              </span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: F, fontSize: 13, color: "#FFFFFF66", marginBottom: 4 }}>Unconfirmed Triggers</div>
            <div style={{ fontFamily: M, fontSize: 22, fontWeight: 700, color: metrics.unconfirmedHighScores > 5 ? "#f87171" : "#FFFFFF88" }}>
              {metrics.unconfirmedHighScores}
            </div>
          </div>
        </div>
      )}

      {/* Command breakdown */}
      {Object.keys(metrics.commandTypes).length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: F, fontSize: 13, color: "#FFFFFF44", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Command Breakdown
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {Object.entries(metrics.commandTypes)
              .sort((a, b) => b[1] - a[1])
              .map(([action, count]) => (
                <div key={action} style={{
                  padding: "6px 12px", borderRadius: 6,
                  background: "rgba(78,205,196,0.08)", border: "1px solid rgba(78,205,196,0.15)",
                  fontFamily: M, fontSize: 12, color: "#4ECDC4",
                }}>
                  {action} <span style={{ color: "#FFFFFF44" }}>×{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Recent events */}
      {metrics.recentEvents.length > 0 && (
        <div>
          <div style={{ fontFamily: F, fontSize: 13, color: "#FFFFFF44", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Recent Events
          </div>
          <div style={{ maxHeight: 250, overflowY: "auto" }}>
            {metrics.recentEvents.map((e, i) => (
              <EventRow key={`${e.timestamp}-${i}`} event={e} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
