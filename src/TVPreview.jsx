import { useState, useEffect, useRef } from "react";

const TV_W = 1920;
const TV_H = 1080;
const STATUS_H = 36;

export default function TVPreview() {
  const [scale, setScale] = useState(0);
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
          Live Preview — {TV_W}×{TV_H}
        </span>
        <button
          onClick={() => iframeRef.current?.contentWindow?.location.reload()}
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
          <iframe
            ref={iframeRef}
            src={import.meta.env.BASE_URL}
            style={{
              width: TV_W, height: TV_H, border: "none",
              transform: `scale(${scale})`, transformOrigin: "top left",
            }}
            title="Home Center TV"
          />
        </div>
      </div>
    </div>
  );
}
