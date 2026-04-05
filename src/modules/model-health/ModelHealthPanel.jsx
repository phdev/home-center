import { Panel, PanelHeader } from "../../components/Panel";
import { useModelHealth } from "./useModelHealth";

const TIER_COLORS = {
  ok: "#4ade80",
  disabled: "#555",
  error: "#f87171",
  degraded: "#fbbf24",
};

const TIER_LABELS = {
  edge: "Edge",
  cache: "Cache",
  local: "Local",
  groq: "Groq",
  anthropic: "Claude",
};

const ROUTING_COLORS = {
  cache: "#60a5fa",
  local: "#4ade80",
  groq: "#fbbf24",
  anthropic: "#f87171",
};

function StatusDot({ status }) {
  const color = TIER_COLORS[status] || TIER_COLORS.disabled;
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        boxShadow: status === "ok" ? `0 0 6px ${color}` : "none",
        flexShrink: 0,
      }}
    />
  );
}

function RoutingBar({ pct }) {
  if (!pct) return null;
  const segments = ["cache", "local", "groq", "anthropic"].filter(
    (k) => pct[k] > 0
  );
  return (
    <div
      style={{
        display: "flex",
        height: 6,
        borderRadius: 3,
        overflow: "hidden",
        background: "rgba(255,255,255,0.05)",
      }}
    >
      {segments.map((k) => (
        <div
          key={k}
          style={{
            width: `${pct[k]}%`,
            background: ROUTING_COLORS[k],
            minWidth: pct[k] > 0 ? 2 : 0,
          }}
        />
      ))}
    </div>
  );
}

// Icon: simple activity/pulse SVG
function ActivityIcon() {
  return (
    <svg
      width={28}
      height={28}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#4ade80"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

export function ModelHealthPanel({ selected = false, onExpand }) {
  const { data, loading } = useModelHealth();

  if (loading && !data) {
    return (
      <Panel selected={selected} style={{ height: "100%" }}>
        <PanelHeader icon={<ActivityIcon />} label="Models" />
        <div
          style={{
            color: "#FFFFFF44",
            fontSize: 14,
            fontFamily: "'Geist','Inter',system-ui,sans-serif",
          }}
        >
          Loading...
        </div>
      </Panel>
    );
  }

  if (!data) {
    return (
      <Panel selected={selected} style={{ height: "100%" }}>
        <PanelHeader icon={<ActivityIcon />} label="Models" />
        <div
          style={{
            color: "#FFFFFF44",
            fontSize: 14,
            fontFamily: "'Geist','Inter',system-ui,sans-serif",
          }}
        >
          No data available
        </div>
      </Panel>
    );
  }

  const { tiers, today, last_query } = data;

  const expandBtn = onExpand ? (
    <span
      onClick={onExpand}
      style={{ cursor: "pointer", fontSize: 13, color: "#FFFFFF44", fontFamily: "'Geist','Inter',system-ui,sans-serif" }}
    >
      ↗
    </span>
  ) : null;

  return (
    <Panel selected={selected} style={{ height: "100%" }}>
      <PanelHeader
        icon={<ActivityIcon />}
        label="Models"
        subtitle={`${today.total_queries} today`}
        right={expandBtn}
      />

      {/* Tier status dots */}
      <div
        style={{
          display: "flex",
          gap: 14,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        {Object.entries(TIER_LABELS).map(([key, label]) => (
          <div
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 13,
              fontFamily: "'Geist','Inter',system-ui,sans-serif",
              color: "#FFFFFF88",
            }}
          >
            <StatusDot status={tiers[key]?.status || "disabled"} />
            {label}
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "flex",
          gap: 20,
          marginBottom: 14,
          fontSize: 13,
          fontFamily: "'Geist','Inter',system-ui,sans-serif",
          color: "#FFFFFF88",
        }}
      >
        <div>
          <span style={{ color: "#4ECDC4", fontWeight: 600, fontSize: 18 }}>
            {(today.cache_hit_rate * 100).toFixed(0)}%
          </span>
          <div style={{ fontSize: 11, marginTop: 2 }}>Cache hit</div>
        </div>
        <div>
          <span style={{ color: "#4ECDC4", fontWeight: 600, fontSize: 18 }}>
            ${today.total_cost_usd.toFixed(3)}
          </span>
          <div style={{ fontSize: 11, marginTop: 2 }}>Cost today</div>
        </div>
      </div>

      {/* Routing bar */}
      <RoutingBar pct={today.routing_pct} />

      {/* Routing legend */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 6,
          fontSize: 10,
          fontFamily: "'Geist','Inter',system-ui,sans-serif",
          color: "#FFFFFF55",
        }}
      >
        {["cache", "local", "groq", "anthropic"]
          .filter((k) => today.routing_pct[k] > 0)
          .map((k) => (
            <span key={k} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: 2,
                  background: ROUTING_COLORS[k],
                }}
              />
              {k} {today.routing_pct[k].toFixed(0)}%
            </span>
          ))}
      </div>

      {/* Last query */}
      {last_query && (
        <div
          style={{
            marginTop: 14,
            padding: "8px 10px",
            background: "rgba(255,255,255,0.03)",
            borderRadius: 6,
            fontSize: 12,
            fontFamily: "'Geist','Inter',system-ui,sans-serif",
            color: "#FFFFFF66",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ color: "#FFFFFF99" }}>Last query</span>
            <span>
              {last_query.tier} · {last_query.latency_ms}ms
            </span>
          </div>
          <div
            style={{
              color: "#FFFFFF",
              fontSize: 13,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            "{last_query.text}"
          </div>
        </div>
      )}
    </Panel>
  );
}
