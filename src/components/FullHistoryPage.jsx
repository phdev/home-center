import { useTime } from "../hooks/useTime";
import { ArrowLeft, MapPin, User, Bug, Flower2, Calendar, Lightbulb, Clock } from "lucide-react";

const F = "'Geist','Inter',system-ui,sans-serif";
const M = "'JetBrains Mono',ui-monospace,monospace";
const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const TYPE_ICONS = {
  location: MapPin,
  person: User,
  fauna: Bug,
  flora: Flower2,
  event: Calendar,
  concept: Lightbulb,
};

const TYPE_COLORS = {
  location: "#4ECDC4",
  person: "#FFE66D",
  fauna: "#6BCB77",
  flora: "#FF8A5C",
  event: "#3498DB",
  concept: "#9B59B6",
};

function relativeTime(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Top Bar ─────────────────────────────────────────────────────────

function TopBar({ onBack, count, now }) {
  const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const dateStr = `${dayNames[now.getDay()]}, ${SHORT_MONTHS[now.getMonth()]} ${now.getDate()}`;
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
        <Clock size={26} color="#FFFFFF88" />
        <span style={{ fontFamily: F, fontSize: 33, fontWeight: 700, color: "#FFF" }}>History</span>
      </div>

      <span style={{ fontFamily: F, fontSize: 22, color: "#FFFFFF88" }}>
        {count} {count === 1 ? "Query" : "Queries"}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontFamily: F, fontSize: 22, color: "#FFFFFF88" }}>{dateStr}</span>
        <span style={{ fontFamily: M, fontSize: 42, fontWeight: 600, color: "#FFF" }}>
          {h}:{m} {ampm}
        </span>
      </div>
    </div>
  );
}

// ─── Query Card ──────────────────────────────────────────────────────

function QueryCard({ item, onSelect }) {
  const Icon = TYPE_ICONS[item.type] || Lightbulb;
  const color = TYPE_COLORS[item.type] || "#9B59B6";

  return (
    <div
      onClick={() => onSelect(item)}
      style={{
        display: "flex", alignItems: "flex-start", gap: 16,
        padding: "18px 20px", borderRadius: 8,
        background: "#FFFFFF06", border: "1px solid #FFFFFF15",
        cursor: "pointer",
        transition: "background 200ms",
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = "#FFFFFF10"}
      onMouseLeave={(e) => e.currentTarget.style.background = "#FFFFFF06"}
    >
      {/* Type icon */}
      <div style={{
        width: 44, height: 44, borderRadius: 22, flexShrink: 0,
        background: `${color}15`, border: `1px solid ${color}30`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={20} color={color} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontFamily: F, fontSize: 20, fontWeight: 600, color: "#FFFFFF" }}>
            {item.title}
          </span>
          <span style={{ fontFamily: M, fontSize: 13, color: "#FFFFFF44", flexShrink: 0 }}>
            {relativeTime(item.timestamp)}
          </span>
        </div>
        <div style={{
          fontFamily: F, fontSize: 15, color: "#FFFFFF88",
          lineHeight: 1.5,
          display: "-webkit-box", WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {item.summary}
        </div>
        <div style={{
          fontFamily: M, fontSize: 12, color: "#FFFFFF33",
          marginTop: 6, textTransform: "uppercase", letterSpacing: 1,
        }}>
          {item.type}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────

export function FullHistoryPage({ history, loading, onBack, onSelect }) {
  const now = useTime();
  const items = history || [];

  return (
    <div style={{
      width: "100%", height: "100vh", background: "#000", display: "flex",
      flexDirection: "column", overflow: "hidden",
      fontFamily: F, color: "#FFF",
    }}>
      <TopBar onBack={onBack} count={items.length} now={now} />

      <div style={{ flex: 1, padding: 20, minHeight: 0, overflowY: "auto" }}>
        {loading && (
          <div style={{
            height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, color: "#FFFFFF66",
          }}>
            Loading history...
          </div>
        )}

        {!loading && items.length === 0 && (
          <div style={{
            height: "100%", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 12,
          }}>
            <Clock size={48} color="#FFFFFF33" />
            <span style={{ fontSize: 24, color: "#FFFFFF66" }}>
              No queries yet
            </span>
            <span style={{ fontSize: 16, color: "#FFFFFF44" }}>
              Ask "Hey Homer" a question to get started
            </span>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map((item) => (
              <QueryCard key={item.id} item={item} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
