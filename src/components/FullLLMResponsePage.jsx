import { useTime } from "../hooks/useTime";
import { ArrowLeft, MapPin, User, Bug, Flower2, Calendar, Lightbulb } from "lucide-react";
import { GlassesIndicator } from "./GlassesIndicator";

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

// ─── Top Bar ─────────────────────────────────────────────────────────

function TopBar({ onBack, response, now, handControllerConnected }) {
  const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const dateStr = `${dayNames[now.getDay()]}, ${SHORT_MONTHS[now.getMonth()]} ${now.getDate()}`;
  const h = now.getHours() % 12 || 12;
  const m = String(now.getMinutes()).padStart(2, "0");
  const ampm = now.getHours() >= 12 ? "PM" : "AM";

  const Icon = TYPE_ICONS[response.type] || Lightbulb;
  const color = TYPE_COLORS[response.type] || "#9B59B6";

  return (
    <div style={{
      width: "100%", height: 70, display: "flex", alignItems: "center",
      justifyContent: "space-between", padding: "0 24px", flexShrink: 0,
      borderBottom: "1px solid #FFFFFF30",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={onBack}>
        <ArrowLeft size={30} color="#FFFFFF" />
        <Icon size={26} color={color} />
        <span style={{ fontFamily: F, fontSize: 33, fontWeight: 700, color: "#FFF" }}>
          {response.title}
        </span>
      </div>

      <span style={{ fontFamily: F, fontSize: 18, color: "#FFFFFF44", fontStyle: "italic" }}>
        "{response.query}"
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <GlassesIndicator connected={handControllerConnected} />
        <span style={{ fontFamily: F, fontSize: 22, color: "#FFFFFF88" }}>{dateStr}</span>
        <span style={{ fontFamily: M, fontSize: 42, fontWeight: 600, color: "#FFF" }}>
          {h}:{m} {ampm}
        </span>
      </div>
    </div>
  );
}

// ─── Section Card ────────────────────────────────────────────────────

function SectionCard({ heading, content }) {
  return (
    <div style={{
      padding: 20, borderRadius: 8,
      background: "#FFFFFF08", border: "1px solid #FFFFFF20",
    }}>
      <div style={{
        fontFamily: F, fontSize: 18, fontWeight: 700,
        color: "#FFFFFF", marginBottom: 10,
      }}>
        {heading}
      </div>
      <div style={{
        fontFamily: F, fontSize: 16, color: "#FFFFFFCC",
        lineHeight: 1.6, whiteSpace: "pre-wrap",
      }}>
        {content}
      </div>
    </div>
  );
}

// ─── Infographic Card ────────────────────────────────────────────────

function InfographicCard({ infographic, typeColor }) {
  if (!infographic?.items?.length) return null;

  return (
    <div style={{
      padding: 20, borderRadius: 8,
      background: "#FFFFFF08", border: "1px solid #FFFFFF20",
    }}>
      <div style={{
        fontFamily: F, fontSize: 16, fontWeight: 600,
        color: "#FFFFFF88", marginBottom: 16,
        textTransform: "uppercase", letterSpacing: 1,
      }}>
        Key Facts
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {infographic.items.map((item, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 16px", borderRadius: 6,
            background: "#FFFFFF06", border: "1px solid #FFFFFF10",
          }}>
            <span style={{ fontFamily: F, fontSize: 14, color: "#FFFFFF88" }}>
              {item.label}
            </span>
            <span style={{ fontFamily: M, fontSize: 18, fontWeight: 600, color: typeColor }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────

export function FullLLMResponsePage({ response, onBack, handControllerConnected }) {
  const now = useTime();

  if (!response) return null;

  const typeColor = TYPE_COLORS[response.type] || "#9B59B6";

  return (
    <div style={{
      width: "100%", height: "100vh", background: "#000", display: "flex",
      flexDirection: "column", overflow: "hidden",
      fontFamily: F, color: "#FFF",
    }}>
      <TopBar onBack={onBack} response={response} now={now} handControllerConnected={handControllerConnected} />

      <div style={{
        flex: 1, display: "flex", gap: 20, padding: 20, minHeight: 0,
      }}>
        {/* Left column: Summary + Sections */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column", gap: 16,
          minHeight: 0, overflowY: "auto",
        }}>
          {/* Summary */}
          <div style={{
            padding: 20, borderRadius: 8,
            background: `${typeColor}10`, border: `1px solid ${typeColor}30`,
          }}>
            <div style={{
              fontFamily: F, fontSize: 20, color: "#FFFFFF",
              lineHeight: 1.6,
            }}>
              {response.summary}
            </div>
          </div>

          {/* Sections */}
          {(response.sections || []).map((s, i) => (
            <SectionCard key={i} heading={s.heading} content={s.content} />
          ))}
        </div>

        {/* Right column: Infographic + Image */}
        <div style={{
          width: 400, flexShrink: 0, display: "flex", flexDirection: "column",
          gap: 16, minHeight: 0, overflowY: "auto",
        }}>
          <InfographicCard infographic={response.infographic} typeColor={typeColor} />

          {response.imageUrl && (
            <div style={{
              borderRadius: 8, overflow: "hidden",
              border: "1px solid #FFFFFF20", flexShrink: 0,
            }}>
              <img
                src={response.imageUrl}
                alt={response.title}
                style={{ width: "100%", display: "block", objectFit: "cover" }}
              />
            </div>
          )}

          {/* Type badge */}
          <div style={{
            padding: "10px 16px", borderRadius: 8,
            background: "#FFFFFF06", border: "1px solid #FFFFFF10",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            {(() => {
              const Icon = TYPE_ICONS[response.type] || Lightbulb;
              return <Icon size={16} color={typeColor} />;
            })()}
            <span style={{
              fontFamily: M, fontSize: 13, color: "#FFFFFF66",
              textTransform: "uppercase", letterSpacing: 1,
            }}>
              {response.type}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
