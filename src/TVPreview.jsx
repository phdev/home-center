import { useState, useEffect, useRef } from "react";

const TV_W = 1920;
const TV_H = 1080;
const STATUS_H = 36;

// Pencil design pages (static screenshots)
const PENCIL_PAGES = [
  { slug: "family-tv-dashboard", label: "Family TV Dashboard", nodeId: "8pkH2" },
  { slug: "full-calendar-page", label: "Full Calendar Page", nodeId: "85GSD" },
  { slug: "weekly-calendar-design", label: "Weekly Calendar Design", nodeId: "ZPJSg" },
  { slug: "daily-calendar-design", label: "Daily Calendar Design", nodeId: "jRHG1" },
  { slug: "full-weather-page", label: "Full Weather Page Design", nodeId: "VD32B" },
  { slug: "full-photos-page", label: "Full Photos Page Design", nodeId: "ZOFqi" },
  { slug: "full-llm-response-page", label: "LLM Response Page Design", nodeId: "dMUil" },
  { slug: "full-history-page", label: "History Page Design", nodeId: "Tbtje" },
  { slug: "transcription-overlay", label: "Transcription Overlay Design", nodeId: "DeP7G" },
  { slug: "voice-transcription-overlay", label: "Voice Transcription (Hey Homer)", nodeId: "Jf7Tx" },
  { slug: "openclaw-ui-additions", label: "OpenClaw UI Additions (8 new cards)", nodeId: "ONYZi" },
];

// Live view pages (rendered via iframe with URL params)
const LIVE_VIEWS = [
  { slug: "weekly-calendar", label: "Weekly Calendar", params: "?page=calendar&view=weekly" },
  { slug: "daily-calendar", label: "Daily Calendar", params: "?page=calendar&view=daily" },
  { slug: "monthly-calendar", label: "Monthly Calendar", params: "?page=calendar&view=monthly" },
  { slug: "weather", label: "Weather Page", params: "?page=weather" },
  { slug: "photos", label: "Photos Page", params: "?page=photos" },
  { slug: "history", label: "Query History", params: "?page=history" },
  { slug: "tv-clip-mount", label: "TV Clip Mount Design", params: "../tv-clip-mount" },
];

export default function TVPreview() {
  const [scale, setScale] = useState(0);
  const [view, setView] = useState("app"); // "app" | pencil slug | live slug
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

  const activePencil = PENCIL_PAGES.find((p) => p.slug === view);
  const activeLive = LIVE_VIEWS.find((p) => p.slug === view);
  const isIframe = view === "app" || activeLive;

  const iframeSrc = activeLive
    ? `${import.meta.env.BASE_URL}${activeLive.params}`
    : import.meta.env.BASE_URL;

  const statusLabel = view === "app"
    ? `Live — ${TV_W}×${TV_H}`
    : activeLive
      ? `Live — ${activeLive.label}`
      : `Design — ${activePencil?.label}`;

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
          {statusLabel}
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
          <option value="app">Live Dashboard</option>
          <optgroup label="Full Pages">
            {LIVE_VIEWS.map((p) => (
              <option key={p.slug} value={p.slug}>{p.label}</option>
            ))}
          </optgroup>
          <optgroup label="Pencil Designs">
            {PENCIL_PAGES.map((p) => (
              <option key={p.slug} value={p.slug}>{p.label}</option>
            ))}
          </optgroup>
        </select>

        <button
          onClick={() => {
            if (isIframe) {
              iframeRef.current?.contentWindow?.location.reload();
            } else {
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
          {isIframe ? (
            <iframe
              key={view}
              ref={iframeRef}
              src={iframeSrc}
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
                    No screenshot for "{activePencil?.label}"
                  </div>
                  <div style={{ fontSize: 14, color: "#444" }}>
                    Export from Pencil editor to public/pencil-screenshots/{view}.png
                  </div>
                </div>
              ) : (
                <img
                  src={`${import.meta.env.BASE_URL}pencil-screenshots/${view}.png?t=${Date.now()}`}
                  alt={activePencil?.label}
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
