import { useState, useEffect } from "react";
import { useTime } from "../hooks/useTime";
import { ArrowLeft, ImageIcon } from "lucide-react";

const F = "'Geist','Inter',system-ui,sans-serif";
const M = "'JetBrains Mono',ui-monospace,monospace";
const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Top Bar ─────────────────────────────────────────────────────────

function TopBar({ onBack, photoCount, now }) {
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

      <span style={{ fontFamily: F, fontSize: 22, color: "#FFFFFF88" }}>
        {photoCount} {photoCount === 1 ? "Photo" : "Photos"}
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

// ─── Featured Photo Sidebar ──────────────────────────────────────────

function FeaturedSidebar({ photos }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!photos || photos.length <= 1) return;
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % photos.length);
    }, 5000);
    return () => clearInterval(id);
  }, [photos]);

  if (!photos || photos.length === 0) return null;

  const photo = photos[index];

  return (
    <div style={{
      width: 350, flexShrink: 0, display: "flex", flexDirection: "column",
      gap: 12, overflow: "hidden",
    }}>
      {/* Large featured photo */}
      <div style={{
        width: "100%", flex: 1, borderRadius: 8, overflow: "hidden",
        border: "1px solid #FFFFFF30", background: "#FFFFFF10",
        minHeight: 0,
      }}>
        <img
          src={photo.url}
          alt={photo.cap || ""}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>

      {/* Caption */}
      {photo.cap && (
        <span style={{ fontFamily: F, fontSize: 18, fontWeight: 500, color: "#FFFFFFCC" }}>
          {photo.cap}
        </span>
      )}

      {/* Counter */}
      <span style={{ fontFamily: M, fontSize: 14, color: "#FFFFFF66" }}>
        {index + 1} of {photos.length}
      </span>
    </div>
  );
}

// ─── Photo Grid ──────────────────────────────────────────────────────

function PhotoGrid({ photos }) {
  if (!photos || photos.length === 0) return null;

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      border: "1px solid #FFFFFF", borderRadius: 8, overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        height: 50, display: "flex", alignItems: "center", padding: "0 20px",
        background: "#FFFFFF08", borderBottom: "1px solid #FFFFFF20", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ImageIcon size={20} color="#FFF" />
          <span style={{ fontFamily: F, fontSize: 22, fontWeight: 600, color: "#FFF" }}>
            All Photos
          </span>
        </div>
      </div>

      {/* Grid */}
      <div style={{
        flex: 1, overflow: "auto", padding: 8,
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 8,
        alignContent: "start",
      }}>
        {photos.map((p, i) => (
          <div key={i} style={{
            aspectRatio: "3 / 2",
            borderRadius: 8, overflow: "hidden",
            border: "1px solid #FFFFFF30", background: "#FFFFFF10",
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
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────

export function FullPhotosPage({ photos, loading, error, onBack }) {
  const now = useTime();
  const items = photos || [];

  return (
    <div style={{
      width: "100%", height: "100vh", background: "#000", display: "flex",
      flexDirection: "column", overflow: "hidden",
      fontFamily: F, color: "#FFF",
    }}>
      <TopBar onBack={onBack} photoCount={items.length} now={now} />
      <div style={{
        flex: 1, display: "flex", gap: 16, padding: 16, minHeight: 0,
      }}>
        {loading && (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: F, fontSize: 24, color: "#FFFFFF66",
          }}>
            Loading photos...
          </div>
        )}
        {error && !loading && (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: F, fontSize: 24, color: "#FFFFFF66",
          }}>
            {error}
          </div>
        )}
        {items.length > 0 && !loading && (
          <>
            <FeaturedSidebar photos={items} />
            <PhotoGrid photos={items} />
          </>
        )}
        {items.length === 0 && !loading && !error && (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: F, fontSize: 24, color: "#FFFFFF66",
          }}>
            No photos available
          </div>
        )}
      </div>
    </div>
  );
}
