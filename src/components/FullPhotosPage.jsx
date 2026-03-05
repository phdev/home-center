import { useEffect, useRef } from "react";
import { useTime } from "../hooks/useTime";
import { ArrowLeft } from "lucide-react";
import { GlassesIndicator } from "./GlassesIndicator";

const F = "'Geist','Inter',system-ui,sans-serif";
const M = "'JetBrains Mono',ui-monospace,monospace";
const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const SCROLL_STEP = 400; // px per scroll gesture

// ─── Top Bar ─────────────────────────────────────────────────────────

function TopBar({ onBack, photoCount, columns, now, handControllerConnected }) {
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
        <span style={{ fontFamily: F, fontSize: 33, fontWeight: 700, color: "#FFF" }}>Photos</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontFamily: F, fontSize: 22, color: "#FFFFFF88" }}>
          {photoCount} {photoCount === 1 ? "Photo" : "Photos"}
        </span>
        {columns !== 4 && (
          <span style={{ fontFamily: M, fontSize: 16, color: "#FFFFFF44" }}>
            {columns} col
          </span>
        )}
      </div>

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

// ─── Main Page ───────────────────────────────────────────────────────

export function FullPhotosPage({ photos, loading, error, onBack, columns = 4, scrollDir = 0, handControllerConnected }) {
  const now = useTime();
  const items = photos || [];
  const scrollRef = useRef(null);

  // Handle scroll gestures from hand controller
  useEffect(() => {
    if (scrollDir === 0 || !scrollRef.current) return;
    scrollRef.current.scrollBy({ top: scrollDir * SCROLL_STEP, behavior: "smooth" });
  }, [scrollDir]);

  return (
    <div style={{
      width: "100%", height: "100vh", background: "#000", display: "flex",
      flexDirection: "column", overflow: "hidden",
      fontFamily: F, color: "#FFF",
    }}>
      <TopBar onBack={onBack} photoCount={items.length} columns={columns} now={now} handControllerConnected={handControllerConnected} />
      <div ref={scrollRef} style={{ flex: 1, padding: 16, minHeight: 0, overflow: "auto" }}>
        {loading && (
          <div style={{
            height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, color: "#FFFFFF66",
          }}>
            Loading photos...
          </div>
        )}
        {error && !loading && (
          <div style={{
            height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, color: "#FFFFFF66",
          }}>
            {error}
          </div>
        )}
        {items.length > 0 && !loading && (
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 12,
            alignContent: "start",
            transition: "all 300ms ease",
          }}>
            {items.map((p, i) => (
              <div key={i} style={{
                aspectRatio: "3 / 2",
                borderRadius: 10, overflow: "hidden",
                border: "1px solid #FFFFFF30", background: "#FFFFFF10",
                transition: "all 300ms ease",
              }}>
                {p.url && (
                  <img
                    src={p.url}
                    alt={p.cap || ""}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
        {items.length === 0 && !loading && !error && (
          <div style={{
            height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, color: "#FFFFFF66",
          }}>
            No photos available
          </div>
        )}
      </div>
    </div>
  );
}
