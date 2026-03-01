import { useState, useEffect, useRef } from "react";

const TV_W = 1920;
const TV_H = 1080;
const STATUS_H = 36;

// Pencil design pages — add new pages here as they're created.
// Slugs must match filenames in public/pencil-screenshots/{slug}.png
const PENCIL_PAGES = [
  { slug: "family-tv-dashboard", label: "Family TV Dashboard", nodeId: "8pkH2" },
  { slug: "full-calendar-page", label: "Full Calendar Page", nodeId: "85GSD" },
  { slug: "weekly-calendar-page", label: "Weekly Calendar Page", nodeId: "ZPJSg" },
  { slug: "daily-calendar-page", label: "Daily Calendar Page", nodeId: "jRHG1" },
];

export default function TVPreview() {
  const [scale, setScale] = useState(0);
  const [view, setView] = useState("app"); // "app" | slug
  const [imgError, setImgError] = useState({});
  const iframeRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.add("tv-preview");
    return () => document.documentElement.classList.remove("tv-preview");
  }, []);

  useEffect(() => {
    const fit = () => {
      const vw = window.innerWidth;
      const available = window.innerHeight - STATUS_H;
      setScale(Math.min(vw / TV_W, available / TV_H));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const activePage = PENCIL_PAGES.find((p) => p.slug === view);

  return (
    <div style={{
      width: "100%", height: "100dvh", background: "#000",
      display: "flex", flexDirection: "column", alignItems: "center",
      overflow: "hidden", touchAction: "manipulation",
    }}>
      {/* Status bar */}
      <div style={{
        width: "100%", height: STATUS_H, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 10px",
        background: "#111", borderBottom: "1px solid #222", flexShrink: 0,
      }}>
        <span style={{ fontFamily: "system-ui, sans-serif", fontSize: 12, color: "#888" }}>
          {view === "app" ? `Live — ${TV_W}×${TV_H}` : `Design — ${activePage?.label}`}
        </span>

        <select
          value={view}
          onChange={(e) => { setView(e.target.value); setImgError({}); }}
          style={{
            background: "#222", color: "#ccc", border: "1px solid #333",
            borderRadius: 4, padding: "3px 6px", fontSize: 11,
            fontFamily: "system-ui, sans-serif", outline: "none",
          }}
        >
          <option value="app">Live App</option>
          {PENCIL_PAGES.map((p) => (
            <option key={p.slug} value={p.slug}>{p.label} (Design)</option>
          ))}
        </select>

        <button
          onClick={() => {
            if (view === "app") {
              iframeRef.current?.contentWindow?.location.reload();
            } else {
              // Force re-fetch screenshot by cache-busting
              setImgError({});
            }
          }}
          style={{
            background: "none", border: "none", color: "#666",
            fontSize: 16, cursor: "pointer", padding: "4px 8px", lineHeight: 1,
          }}
        >↻</button>
      </div>

      {/* Scaled TV container */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center",
        justifyContent: "center", width: "100%",
      }}>
        <div style={{
          width: TV_W * scale, height: TV_H * scale,
          overflow: "hidden", borderRadius: 3,
          boxShadow: "0 0 24px rgba(255,255,255,0.03)",
        }}>
          {view === "app" ? (
            <iframe
              ref={iframeRef}
              src={import.meta.env.BASE_URL}
              style={{
                width: TV_W, height: TV_H, border: "none",
                transform: `scale(${scale})`, transformOrigin: "top left",
              }}
              title="Home Center TV"
            />
          ) : (
            <div style={{
              width: TV_W, height: TV_H,
              transform: `scale(${scale})`, transformOrigin: "top left",
              background: "#0a0a0a",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {imgError[view] ? (
                <div style={{
                  textAlign: "center", fontFamily: "system-ui, sans-serif",
                  color: "#666", padding: 40,
                }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>📐</div>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>
                    No screenshot for "{activePage?.label}"
                  </div>
                  <div style={{ fontSize: 14, color: "#444" }}>
                    Export from Pencil editor to public/pencil-screenshots/{view}.png
                  </div>
                </div>
              ) : (
                <img
                  src={`${import.meta.env.BASE_URL}pencil-screenshots/${view}.png?t=${Date.now()}`}
                  alt={activePage?.label}
                  onError={() => setImgError((prev) => ({ ...prev, [view]: true }))}
                  style={{ width: TV_W, height: TV_H, objectFit: "contain" }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
