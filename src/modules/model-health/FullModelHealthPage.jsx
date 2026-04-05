import { useTime } from "../../hooks/useTime";
import { useModelHealth } from "./useModelHealth";
import { usePerformanceMetrics } from "./usePerformanceMetrics";
import { WakeWordMetrics } from "./WakeWordMetrics";
import { TaskMetrics } from "./TaskMetrics";
import { ArrowLeft } from "lucide-react";

const F = "'Geist','Inter',system-ui,sans-serif";
const M = "'JetBrains Mono',ui-monospace,monospace";

const TIER_COLORS = {
  ok: "#4ade80",
  disabled: "#555",
  error: "#f87171",
  degraded: "#fbbf24",
};

const ROUTING_COLORS = {
  cache: "#60a5fa",
  local: "#4ade80",
  groq: "#fbbf24",
  anthropic: "#f87171",
};

const TIER_LABELS = {
  edge: "Edge (Gemma E2B)",
  cache: "Semantic Cache",
  local: "Local (Qwen 35B)",
  groq: "Groq (Llama 70B)",
  anthropic: "Anthropic (Claude)",
};

function TopBar({ onBack, now }) {
  const h = now.getHours() % 12 || 12;
  const m = String(now.getMinutes()).padStart(2, "0");
  const ampm = now.getHours() >= 12 ? "PM" : "AM";

  return (
    <div style={{
      width: "100%", height: 70, display: "flex", alignItems: "center",
      justifyContent: "space-between", padding: "0 24px", flexShrink: 0,
      borderBottom: "1px solid #FFFFFF30",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={onBack}>
        <ArrowLeft size={30} color="#FFFFFF" />
        <span style={{ fontFamily: F, fontSize: 33, fontWeight: 700, color: "#FFF" }}>Model Health</span>
      </div>
      <span style={{ fontFamily: M, fontSize: 42, fontWeight: 600, color: "#FFF" }}>
        {h}:{m} {ampm}
      </span>
    </div>
  );
}

function StatusDot({ status, size = 12 }) {
  const color = TIER_COLORS[status] || TIER_COLORS.disabled;
  return (
    <span style={{
      display: "inline-block", width: size, height: size, borderRadius: "50%",
      background: color, boxShadow: status === "ok" ? `0 0 8px ${color}` : "none",
      flexShrink: 0,
    }} />
  );
}

function BigStat({ value, label, color = "#4ECDC4" }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: M, fontSize: 52, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: F, fontSize: 16, color: "#FFFFFF66", marginTop: 8 }}>{label}</div>
    </div>
  );
}

function RoutingBar({ pct, height = 20 }) {
  if (!pct) return null;
  const segments = ["cache", "local", "groq", "anthropic"].filter(k => pct[k] > 0);
  return (
    <div style={{ display: "flex", height, borderRadius: height / 2, overflow: "hidden", background: "rgba(255,255,255,0.05)" }}>
      {segments.map(k => (
        <div key={k} style={{
          width: `${pct[k]}%`, background: ROUTING_COLORS[k],
          minWidth: pct[k] > 0 ? 3 : 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {pct[k] > 8 && (
            <span style={{ fontFamily: M, fontSize: 11, color: "#000", fontWeight: 600 }}>
              {pct[k].toFixed(0)}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function TierCard({ name, label, status, stats }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <StatusDot status={status} size={14} />
        <span style={{ fontFamily: F, fontSize: 18, fontWeight: 600, color: "#FFF" }}>{label}</span>
        <span style={{
          marginLeft: "auto", fontFamily: M, fontSize: 13, padding: "2px 10px",
          borderRadius: 6, background: status === "ok" ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.05)",
          color: status === "ok" ? "#4ade80" : "#888",
        }}>
          {status}
        </span>
      </div>
      {stats && (
        <div style={{ display: "flex", gap: 24, fontFamily: M, fontSize: 14, color: "#FFFFFF88" }}>
          {stats.queries_today !== undefined && (
            <span><span style={{ color: "#FFF" }}>{stats.queries_today}</span> queries</span>
          )}
          {stats.hits_today !== undefined && (
            <span><span style={{ color: "#FFF" }}>{stats.hits_today}</span> hits</span>
          )}
          {stats.avg_latency_ms !== undefined && stats.avg_latency_ms > 0 && (
            <span><span style={{ color: "#FFF" }}>{stats.avg_latency_ms}</span>ms avg</span>
          )}
          {stats.cost_today_usd !== undefined && stats.cost_today_usd > 0 && (
            <span><span style={{ color: "#FFF" }}>${stats.cost_today_usd.toFixed(4)}</span> cost</span>
          )}
        </div>
      )}
    </div>
  );
}

function LastQueryCard({ lastQuery }) {
  if (!lastQuery) return null;
  const ago = Math.round((Date.now() - new Date(lastQuery.timestamp).getTime()) / 60000);
  const agoStr = ago < 1 ? "just now" : ago < 60 ? `${ago}m ago` : `${Math.floor(ago / 60)}h ago`;

  return (
    <div style={{
      background: "rgba(78,205,196,0.05)", border: "1px solid rgba(78,205,196,0.15)",
      borderRadius: 12, padding: 20,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontFamily: F, fontSize: 14, color: "#FFFFFF66" }}>Last Query</span>
        <span style={{ fontFamily: M, fontSize: 13, color: "#FFFFFF44" }}>{agoStr}</span>
      </div>
      <div style={{ fontFamily: F, fontSize: 22, color: "#FFF", marginBottom: 8 }}>
        "{lastQuery.text}"
      </div>
      <div style={{ display: "flex", gap: 16, fontFamily: M, fontSize: 14, color: "#FFFFFF88" }}>
        <span style={{
          padding: "2px 10px", borderRadius: 6,
          background: `${ROUTING_COLORS[lastQuery.tier.startsWith("anthropic") ? "anthropic" : lastQuery.tier] || "#555"}22`,
          color: ROUTING_COLORS[lastQuery.tier.startsWith("anthropic") ? "anthropic" : lastQuery.tier] || "#888",
        }}>
          {lastQuery.tier}
        </span>
        <span>{lastQuery.latency_ms}ms</span>
      </div>
    </div>
  );
}

export function FullModelHealthPage({ onBack, workerSettings }) {
  const now = useTime();
  const { data, loading } = useModelHealth();
  const perf = usePerformanceMetrics(workerSettings);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#000",
      display: "flex", flexDirection: "column", overflow: "hidden",
      fontFamily: F, color: "#FFF",
    }}>
      <TopBar onBack={onBack} now={now} />

      {loading && !data ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF44", fontSize: 20 }}>
          Loading model health data...
        </div>
      ) : !data ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF44", fontSize: 20 }}>
          No data available. Run the sync script to generate data.
        </div>
      ) : (
        <div style={{ flex: 1, overflow: "auto", padding: "24px 32px" }}>
          {/* Big stats row */}
          <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 36, padding: "20px 0" }}>
            <BigStat value={data.today.total_queries} label="Queries Today" />
            <BigStat value={`${(data.today.cache_hit_rate * 100).toFixed(1)}%`} label="Cache Hit Rate" color="#60a5fa" />
            <BigStat value={`$${data.today.total_cost_usd.toFixed(4)}`} label="Cost Today" color="#fbbf24" />
            <BigStat
              value={`${data.tiers.local?.avg_latency_ms || 0}ms`}
              label="Local Avg Latency"
              color="#4ade80"
            />
          </div>

          {/* Routing distribution bar */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontFamily: F, fontSize: 14, color: "#FFFFFF66", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Routing Distribution
            </div>
            <RoutingBar pct={data.today.routing_pct} height={28} />
            <div style={{ display: "flex", gap: 20, marginTop: 10, fontFamily: F, fontSize: 13, color: "#FFFFFF66" }}>
              {["cache", "local", "groq", "anthropic"].filter(k => data.today.routing_pct[k] > 0).map(k => (
                <span key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: ROUTING_COLORS[k] }} />
                  {k} — {data.today.routing_pct[k].toFixed(1)}%
                </span>
              ))}
            </div>
          </div>

          {/* Tier cards */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontFamily: F, fontSize: 14, color: "#FFFFFF66", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Tier Status
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {Object.entries(TIER_LABELS).map(([key, label]) => (
                <TierCard
                  key={key}
                  name={key}
                  label={label}
                  status={data.tiers[key]?.status || "disabled"}
                  stats={data.tiers[key]}
                />
              ))}
            </div>
          </div>

          {/* Last query */}
          <LastQueryCard lastQuery={data.last_query} />

          {/* Wake Word Detection Metrics */}
          <div style={{
            marginTop: 32, background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 24,
          }}>
            <div style={{
              fontFamily: F, fontSize: 14, color: "#FFFFFF66", marginBottom: 16,
              textTransform: "uppercase", letterSpacing: "0.05em",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 18 }}>🎤</span> Wake Word Detection
            </div>
            <WakeWordMetrics metrics={perf.wakeMetrics} />
          </div>

          {/* Task Completion Metrics */}
          <div style={{
            marginTop: 20, marginBottom: 32, background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 24,
          }}>
            <div style={{
              fontFamily: F, fontSize: 14, color: "#FFFFFF66", marginBottom: 16,
              textTransform: "uppercase", letterSpacing: "0.05em",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 18 }}>✓</span> Task Completion
            </div>
            <TaskMetrics metrics={perf.taskMetrics} />
          </div>
        </div>
      )}
    </div>
  );
}
