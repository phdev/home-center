import { useState } from "react";

const F = "'Geist','Inter',system-ui,sans-serif";
const M = "'JetBrains Mono',ui-monospace,monospace";

const MODEL_COLORS = {
  cache: "#60a5fa",
  local: "#4ade80",
  groq: "#fbbf24",
  anthropic: "#f87171",
};

const MODEL_LABELS = {
  cache: "Cache",
  local: "Qwen 35B",
  groq: "Llama 70B",
  anthropic: "Claude",
};

const SOURCE_COLORS = {
  openclaw: "#c084fc",
  voice: "#4ade80",
  dashboard: "#60a5fa",
  whatsapp: "#22d3ee",
  homerci: "#fbbf24",
  manual: "#f87171",
};

// ── Inline SVG Sparkline ──

function Sparkline({ data, width = 200, height = 40, color = "#4ECDC4", fillOpacity = 0.15 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data.map(d => d.value), 0.001);
  const min = Math.min(...data.map(d => d.value), 0);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  const points = data.map((d, i) => {
    const x = i * step;
    const y = height - ((d.value - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  const fillPoints = `0,${height} ${points.join(" ")} ${width},${height}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <polygon points={fillPoints} fill={color} opacity={fillOpacity} />
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth={1.5} />
      {/* Latest value dot */}
      {data.length > 0 && (() => {
        const last = data[data.length - 1];
        const x = (data.length - 1) * step;
        const y = height - ((last.value - min) / range) * (height - 4) - 2;
        return <circle cx={x} cy={y} r={3} fill={color} />;
      })()}
    </svg>
  );
}

// ── Horizontal Bar Chart ──

function HorizontalBarChart({ items, maxValue }) {
  if (!items || items.length === 0) return null;
  const mx = maxValue || Math.max(...items.map(i => i.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map(item => (
        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontFamily: F, fontSize: 12, color: "#FFFFFF88", width: 80,
            textAlign: "right", flexShrink: 0, textTransform: "capitalize",
          }}>
            {item.label}
          </span>
          <div style={{
            flex: 1, height: 18, borderRadius: 4,
            background: "rgba(255,255,255,0.04)", overflow: "hidden",
          }}>
            <div style={{
              width: `${(item.value / mx) * 100}%`, height: "100%",
              background: item.color || "#4ECDC4", borderRadius: 4,
              minWidth: item.value > 0 ? 3 : 0,
              display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6,
            }}>
              {(item.value / mx) > 0.15 && (
                <span style={{ fontFamily: M, fontSize: 10, color: "#000", fontWeight: 600 }}>
                  {item.value}
                </span>
              )}
            </div>
          </div>
          {(item.value / mx) <= 0.15 && (
            <span style={{ fontFamily: M, fontSize: 11, color: "#FFFFFF55", flexShrink: 0 }}>
              {item.value}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Stacked Bar Chart (Tool call outcomes) ──

function StackedOutcomeBar({ items }) {
  if (!items || items.length === 0) return null;
  const maxTotal = Math.max(...items.map(i => i.success + i.failure), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map(item => {
        const total = item.success + item.failure;
        const sPct = total > 0 ? (item.success / maxTotal) * 100 : 0;
        const fPct = total > 0 ? (item.failure / maxTotal) * 100 : 0;
        return (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              fontFamily: F, fontSize: 12, color: "#FFFFFF88", width: 80,
              textAlign: "right", flexShrink: 0, textTransform: "capitalize",
            }}>
              {item.label}
            </span>
            <div style={{
              flex: 1, height: 18, borderRadius: 4,
              background: "rgba(255,255,255,0.04)", overflow: "hidden",
              display: "flex",
            }}>
              {item.success > 0 && (
                <div style={{
                  width: `${sPct}%`, height: "100%",
                  background: "#4ade80", minWidth: 2,
                }} />
              )}
              {item.failure > 0 && (
                <div style={{
                  width: `${fPct}%`, height: "100%",
                  background: "#f87171", minWidth: 2,
                }} />
              )}
            </div>
            <span style={{ fontFamily: M, fontSize: 11, color: "#FFFFFF55", flexShrink: 0, width: 70, textAlign: "right" }}>
              {item.success}<span style={{ color: "#4ade8088" }}> ok</span>
              {item.failure > 0 && (
                <> · {item.failure}<span style={{ color: "#f8717188" }}> err</span></>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Panel wrapper (Grafana-style card) ──

function GrafanaPanel({ title, children, style }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12,
      padding: "16px 20px",
      ...style,
    }}>
      <div style={{
        fontFamily: F, fontSize: 12, color: "#FFFFFF44",
        textTransform: "uppercase", letterSpacing: "0.06em",
        marginBottom: 14, fontWeight: 500,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ── Cost Cards with Time Window Selector ──

function CostSection({ costWindows, costTrend }) {
  const [window, setWindow] = useState("24h");
  const windows = ["24h", "7d", "30d"];
  const current = costWindows?.[window] || { total: 0, groq: 0, sonnet: 0, opus: 0 };

  return (
    <GrafanaPanel title="Cost Tracking">
      {/* Time window buttons */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {windows.map(w => (
          <button
            key={w}
            onClick={() => setWindow(w)}
            style={{
              fontFamily: M, fontSize: 11, fontWeight: 600,
              padding: "4px 12px", borderRadius: 6, border: "none",
              cursor: "pointer", transition: "all 0.15s",
              background: window === w ? "#4ECDC4" : "rgba(255,255,255,0.06)",
              color: window === w ? "#000" : "#FFFFFF66",
            }}
          >
            {w}
          </button>
        ))}
      </div>

      {/* Cost stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        <CostCard label="Total" value={current.total} color="#4ECDC4" />
        <CostCard label="Groq" value={current.groq} color="#fbbf24" />
        <CostCard label="Sonnet" value={current.sonnet} color="#f87171" />
        <CostCard label="Opus" value={current.opus} color="#c084fc" />
      </div>

      {/* Cost trend sparkline */}
      {costTrend && costTrend.length > 1 && (
        <div>
          <div style={{ fontFamily: F, fontSize: 11, color: "#FFFFFF33", marginBottom: 6 }}>
            30-day cost trend
          </div>
          <Sparkline data={costTrend} width={460} height={50} color="#4ECDC4" />
        </div>
      )}
    </GrafanaPanel>
  );
}

function CostCard({ label, value, color }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", borderRadius: 8,
      padding: "10px 12px", textAlign: "center",
      border: `1px solid ${color}15`,
    }}>
      <div style={{ fontFamily: M, fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>
        ${value < 0.01 ? value.toFixed(4) : value.toFixed(3)}
      </div>
      <div style={{ fontFamily: F, fontSize: 11, color: "#FFFFFF55", marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ── Token Usage by Model ──

function TokenUsageSection({ tokensByModel, totalTokensByDay }) {
  if (!tokensByModel) return null;
  const tiers = ["local", "groq", "anthropic"].filter(t => tokensByModel[t]);
  const totalIn = tiers.reduce((s, t) => s + tokensByModel[t].input, 0);
  const totalOut = tiers.reduce((s, t) => s + tokensByModel[t].output, 0);

  return (
    <GrafanaPanel title="Token Usage by Model">
      {/* Summary stats */}
      <div style={{ display: "flex", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: M, fontSize: 26, fontWeight: 700, color: "#4ECDC4", lineHeight: 1 }}>
            {formatTokens(totalIn + totalOut)}
          </div>
          <div style={{ fontFamily: F, fontSize: 11, color: "#FFFFFF55", marginTop: 3 }}>Total tokens (30d)</div>
        </div>
        <div>
          <div style={{ fontFamily: M, fontSize: 18, fontWeight: 600, color: "#60a5fa", lineHeight: 1 }}>
            {formatTokens(totalIn)}
          </div>
          <div style={{ fontFamily: F, fontSize: 11, color: "#FFFFFF55", marginTop: 3 }}>Input</div>
        </div>
        <div>
          <div style={{ fontFamily: M, fontSize: 18, fontWeight: 600, color: "#4ade80", lineHeight: 1 }}>
            {formatTokens(totalOut)}
          </div>
          <div style={{ fontFamily: F, fontSize: 11, color: "#FFFFFF55", marginTop: 3 }}>Output</div>
        </div>
      </div>

      {/* Per-model breakdown */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {tiers.map(tier => {
          const d = tokensByModel[tier];
          const total = d.input + d.output;
          const pct = (totalIn + totalOut) > 0 ? ((total / (totalIn + totalOut)) * 100).toFixed(1) : 0;
          return (
            <div key={tier} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "8px 12px", borderRadius: 8,
              background: `${MODEL_COLORS[tier]}08`,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: MODEL_COLORS[tier], flexShrink: 0,
              }} />
              <span style={{ fontFamily: F, fontSize: 13, color: "#FFFFFFCC", width: 80 }}>
                {MODEL_LABELS[tier] || tier}
              </span>
              <div style={{
                flex: 1, height: 6, borderRadius: 3,
                background: "rgba(255,255,255,0.04)", overflow: "hidden",
              }}>
                <div style={{
                  width: `${pct}%`, height: "100%",
                  background: MODEL_COLORS[tier], borderRadius: 3,
                  minWidth: total > 0 ? 3 : 0,
                }} />
              </div>
              <span style={{ fontFamily: M, fontSize: 12, color: "#FFFFFF66", width: 65, textAlign: "right" }}>
                {formatTokens(total)}
              </span>
              <span style={{ fontFamily: M, fontSize: 11, color: "#FFFFFF33", width: 40, textAlign: "right" }}>
                {pct}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Token trend sparkline */}
      {totalTokensByDay && totalTokensByDay.length > 1 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontFamily: F, fontSize: 11, color: "#FFFFFF33", marginBottom: 6 }}>
            Daily token volume
          </div>
          <Sparkline data={totalTokensByDay.map(d => ({ date: d.date, value: d.tokens }))} width={460} height={40} color="#60a5fa" />
        </div>
      )}
    </GrafanaPanel>
  );
}

function formatTokens(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ── Task Families Bar Chart ──

function TaskFamiliesSection({ taskFamilies }) {
  if (!taskFamilies || Object.keys(taskFamilies).length === 0) return null;
  const items = Object.entries(taskFamilies)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({
      label,
      value,
      color: SOURCE_COLORS[label] || "#4ECDC4",
    }));

  return (
    <GrafanaPanel title="Task Families">
      <HorizontalBarChart items={items} />
    </GrafanaPanel>
  );
}

// ── Tool Call Outcomes ──

function ToolCallOutcomesSection({ toolOutcomes }) {
  if (!toolOutcomes || Object.keys(toolOutcomes).length === 0) return null;
  const items = ["cache", "local", "groq", "anthropic"]
    .filter(t => toolOutcomes[t])
    .map(t => ({
      label: MODEL_LABELS[t] || t,
      success: toolOutcomes[t].success,
      failure: toolOutcomes[t].failure,
    }));

  const totalSuccess = items.reduce((s, i) => s + i.success, 0);
  const totalFailure = items.reduce((s, i) => s + i.failure, 0);
  const successRate = totalSuccess + totalFailure > 0
    ? ((totalSuccess / (totalSuccess + totalFailure)) * 100).toFixed(1)
    : "100.0";

  return (
    <GrafanaPanel title="Tool Calls by Outcome">
      <div style={{ display: "flex", gap: 20, marginBottom: 14 }}>
        <div>
          <span style={{ fontFamily: M, fontSize: 22, fontWeight: 700, color: "#4ade80" }}>
            {successRate}%
          </span>
          <span style={{ fontFamily: F, fontSize: 12, color: "#FFFFFF44", marginLeft: 6 }}>success rate</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: F, fontSize: 12, color: "#FFFFFF55" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "#4ade80", display: "inline-block" }} />
            Success ({totalSuccess})
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "#f87171", display: "inline-block" }} />
            Failed ({totalFailure})
          </span>
        </div>
      </div>
      <StackedOutcomeBar items={items} />
    </GrafanaPanel>
  );
}

// ── Session & Cron Status ──

function SessionStatusSection({ sessionStatus }) {
  if (!sessionStatus) return null;

  return (
    <GrafanaPanel title="Session & Sync Status">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
        <StatusItem
          label="Cron Sync"
          value={sessionStatus.cronActive ? "Active" : "Inactive"}
          color={sessionStatus.cronActive ? "#4ade80" : "#f87171"}
          dot
        />
        <StatusItem
          label="Last Sync"
          value={sessionStatus.lastSync}
          color="#60a5fa"
        />
        <StatusItem
          label="Days Tracked"
          value={sessionStatus.totalDays}
          color="#fbbf24"
        />
        <StatusItem
          label="Avg Queries/Day"
          value={sessionStatus.avgDailyQueries}
          color="#4ECDC4"
        />
      </div>
      <div style={{
        display: "flex", gap: 20, marginTop: 14, padding: "10px 14px",
        background: "rgba(255,255,255,0.02)", borderRadius: 8,
      }}>
        <MiniStat label="Total Queries (30d)" value={sessionStatus.totalQueries} color="#FFF" />
        <MiniStat label="Router Uptime" value="99.8%" color="#4ade80" />
        <MiniStat label="Cache DB" value="SQLite" color="#60a5fa" />
        <MiniStat label="Edge Tier" value="Disabled" color="#555" />
      </div>
    </GrafanaPanel>
  );
}

function StatusItem({ label, value, color, dot }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", borderRadius: 8,
      padding: "10px 14px", textAlign: "center",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        {dot && (
          <span style={{
            width: 8, height: 8, borderRadius: "50%", background: color,
            boxShadow: `0 0 6px ${color}`, display: "inline-block",
          }} />
        )}
        <span style={{ fontFamily: M, fontSize: 16, fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{ fontFamily: F, fontSize: 11, color: "#FFFFFF44", marginTop: 3 }}>{label}</div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: M, fontSize: 14, fontWeight: 600, color }}>{value}</div>
      <div style={{ fontFamily: F, fontSize: 11, color: "#FFFFFF33", marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── Query Volume Trend ──

function QueryTrendSection({ queryTrend }) {
  if (!queryTrend || queryTrend.length < 2) return null;
  const total = queryTrend.reduce((s, d) => s + d.value, 0);
  const avg = Math.round(total / queryTrend.length);
  const peak = Math.max(...queryTrend.map(d => d.value));

  return (
    <GrafanaPanel title="Query Volume (30d)">
      <div style={{ display: "flex", gap: 24, marginBottom: 12 }}>
        <div>
          <span style={{ fontFamily: M, fontSize: 22, fontWeight: 700, color: "#FFF" }}>{total}</span>
          <span style={{ fontFamily: F, fontSize: 12, color: "#FFFFFF44", marginLeft: 6 }}>total</span>
        </div>
        <div>
          <span style={{ fontFamily: M, fontSize: 16, fontWeight: 600, color: "#FFFFFF88" }}>{avg}</span>
          <span style={{ fontFamily: F, fontSize: 12, color: "#FFFFFF44", marginLeft: 6 }}>avg/day</span>
        </div>
        <div>
          <span style={{ fontFamily: M, fontSize: 16, fontWeight: 600, color: "#fbbf24" }}>{peak}</span>
          <span style={{ fontFamily: F, fontSize: 12, color: "#FFFFFF44", marginLeft: 6 }}>peak</span>
        </div>
      </div>
      <Sparkline data={queryTrend} width={460} height={50} color="#fbbf24" fillOpacity={0.1} />
    </GrafanaPanel>
  );
}

// ── Main Export ──

export function OrchestratorAnalytics({ analytics }) {
  if (!analytics) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Row 1: Cost + Token Usage side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <CostSection costWindows={analytics.costWindows} costTrend={analytics.costTrend} />
        <TokenUsageSection tokensByModel={analytics.tokensByModel} totalTokensByDay={analytics.totalTokensByDay} />
      </div>

      {/* Row 2: Task Families + Tool Call Outcomes */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <TaskFamiliesSection taskFamilies={analytics.taskFamilies} />
        <ToolCallOutcomesSection toolOutcomes={analytics.toolOutcomes} />
      </div>

      {/* Row 3: Query Trend + Session Status */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <QueryTrendSection queryTrend={analytics.queryTrend} />
        <SessionStatusSection sessionStatus={analytics.sessionStatus} />
      </div>
    </div>
  );
}
