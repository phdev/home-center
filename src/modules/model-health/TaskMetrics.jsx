const F = "'Geist','Inter',system-ui,sans-serif";
const M = "'JetBrains Mono',ui-monospace,monospace";

const SOURCE_COLORS = {
  voice: "#4ade80",
  dashboard: "#60a5fa",
  manual: "#fbbf24",
};

const QUERY_TYPE_COLORS = {
  location: "#4ECDC4",
  person: "#c084fc",
  fauna: "#4ade80",
  flora: "#fbbf24",
  event: "#f87171",
  concept: "#60a5fa",
  general: "#FFFFFF66",
};

function StatBox({ value, label, color = "#FFF" }) {
  return (
    <div style={{ textAlign: "center", minWidth: 90 }}>
      <div style={{ fontFamily: M, fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontFamily: F, fontSize: 12, color: "#FFFFFF66", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function SourceBar({ voice, dashboard }) {
  const total = voice + dashboard;
  if (total === 0) return null;
  const vPct = (voice / total) * 100;
  const dPct = (dashboard / total) * 100;
  return (
    <div>
      <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: "rgba(255,255,255,0.05)" }}>
        {voice > 0 && <div style={{ width: `${vPct}%`, background: SOURCE_COLORS.voice, minWidth: 3 }} />}
        {dashboard > 0 && <div style={{ width: `${dPct}%`, background: SOURCE_COLORS.dashboard, minWidth: 3 }} />}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 6, fontFamily: F, fontSize: 12, color: "#FFFFFF66" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: SOURCE_COLORS.voice }} />
          Voice {voice}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: SOURCE_COLORS.dashboard }} />
          Dashboard {dashboard}
        </span>
      </div>
    </div>
  );
}

function QueryRow({ query }) {
  const time = new Date(query.timestamp);
  const h = time.getHours().toString().padStart(2, "0");
  const m = time.getMinutes().toString().padStart(2, "0");
  const type = query.type || "general";
  const color = QUERY_TYPE_COLORS[type] || "#888";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "6px 0",
      borderBottom: "1px solid rgba(255,255,255,0.03)", fontSize: 13,
    }}>
      <span style={{ fontFamily: M, fontSize: 11, color: "#FFFFFF44", width: 40, flexShrink: 0 }}>
        {h}:{m}
      </span>
      <span style={{
        padding: "1px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
        background: `${color}18`, color, flexShrink: 0,
      }}>
        {type}
      </span>
      <span style={{
        fontFamily: F, fontSize: 13, color: "#FFFFFFCC", flex: 1,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {query.query || query.title || "—"}
      </span>
    </div>
  );
}

export function TaskMetrics({ metrics }) {
  if (!metrics) {
    return (
      <div style={{ color: "#FFFFFF44", fontFamily: F, fontSize: 14, padding: 20 }}>
        No task data available.
      </div>
    );
  }

  return (
    <div>
      {/* Stats row */}
      <div style={{ display: "flex", gap: 24, marginBottom: 24, flexWrap: "wrap", justifyContent: "space-around" }}>
        <StatBox value={metrics.activeTimers} label="Active Timers" color="#4ade80" />
        <StatBox value={metrics.completedTimers} label="Completed" color="#FFFFFF88" />
        <StatBox value={metrics.totalTimers} label="Total Timers" color="#60a5fa" />
        <StatBox value={metrics.llmQueries24h} label="LLM Queries (24h)" color="#4ECDC4" />
        <StatBox value={metrics.ocActiveTasks || 0} label="OpenClaw Active" color="#c084fc" />
        <StatBox value={metrics.ocCompletedTasks || 0} label="OpenClaw Done" color="#c084fc88" />
      </div>

      {/* Timer source breakdown */}
      {metrics.totalTimers > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: F, fontSize: 13, color: "#FFFFFF44", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Timer Sources
          </div>
          <SourceBar voice={metrics.voiceCreated} dashboard={metrics.dashboardCreated} />
        </div>
      )}

      {/* LLM query type breakdown */}
      {Object.keys(metrics.llmQueryTypes).length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: F, fontSize: 13, color: "#FFFFFF44", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Query Types
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {Object.entries(metrics.llmQueryTypes)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <div key={type} style={{
                  padding: "6px 12px", borderRadius: 6,
                  background: `${QUERY_TYPE_COLORS[type] || "#888"}10`,
                  border: `1px solid ${QUERY_TYPE_COLORS[type] || "#888"}25`,
                  fontFamily: M, fontSize: 12, color: QUERY_TYPE_COLORS[type] || "#888",
                }}>
                  {type} <span style={{ color: "#FFFFFF44" }}>×{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* OpenClaw task details */}
      {(metrics.ocTotalTasks || 0) > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: F, fontSize: 13, color: "#FFFFFF44", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            OpenClaw Tasks
          </div>
          {metrics.ocAvgCompletionMs > 0 && (
            <div style={{
              display: "flex", gap: 16, marginBottom: 12, padding: "10px 14px",
              background: "rgba(255,255,255,0.02)", borderRadius: 8,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: F, fontSize: 12, color: "#FFFFFF44", marginBottom: 2 }}>Avg Completion Time</div>
                <div style={{ fontFamily: M, fontSize: 18, fontWeight: 700, color: "#c084fc" }}>
                  {metrics.ocAvgCompletionMs < 60000
                    ? `${(metrics.ocAvgCompletionMs / 1000).toFixed(1)}s`
                    : `${(metrics.ocAvgCompletionMs / 60000).toFixed(1)}m`}
                </div>
              </div>
              {metrics.ocSources && Object.keys(metrics.ocSources).length > 0 && (
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: F, fontSize: 12, color: "#FFFFFF44", marginBottom: 2 }}>Sources</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {Object.entries(metrics.ocSources).map(([src, count]) => (
                      <span key={src} style={{ fontFamily: M, fontSize: 12, color: "#c084fc" }}>
                        {src} <span style={{ color: "#FFFFFF33" }}>×{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {(metrics.ocRecentTasks || []).map((t, i) => (
              <div key={t.id || i} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "6px 0",
                borderBottom: "1px solid rgba(255,255,255,0.03)", fontSize: 13,
              }}>
                <span style={{
                  padding: "1px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, flexShrink: 0,
                  background: t.status === "done" ? "rgba(74,222,128,0.1)" : "rgba(192,132,252,0.1)",
                  color: t.status === "done" ? "#4ade80" : "#c084fc",
                }}>
                  {t.status === "done" ? "done" : "active"}
                </span>
                <span style={{ fontFamily: F, fontSize: 13, color: "#FFFFFFCC", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.title}
                </span>
                {t.source && (
                  <span style={{ fontFamily: M, fontSize: 11, color: "#FFFFFF33" }}>
                    {t.source}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent LLM queries */}
      {metrics.recentQueries.length > 0 && (
        <div>
          <div style={{ fontFamily: F, fontSize: 13, color: "#FFFFFF44", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Recent LLM Queries
          </div>
          <div style={{ maxHeight: 250, overflowY: "auto" }}>
            {metrics.recentQueries.map((q, i) => (
              <QueryRow key={`${q.timestamp}-${i}`} query={q} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
