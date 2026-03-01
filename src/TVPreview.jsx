import { useState, useEffect, useRef } from "react";
import PenPreview from "./PenPreview";

const TV_W = 1920;
const TV_H = 1080;
const STATUS_H = 36;
const INPUT_H = 52;
const POLL_MS = 2000;

export default function TVPreview() {
  const [scale, setScale] = useState(0);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("idle");
  const [lastInstruction, setLastInstruction] = useState("");
  const [view, setView] = useState("app"); // "app" | "pencil"
  const iframeRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.add("tv-preview");
    return () => document.documentElement.classList.remove("tv-preview");
  }, []);

  useEffect(() => {
    const fit = () => {
      const vw = window.innerWidth;
      const available = window.innerHeight - STATUS_H - INPUT_H;
      setScale(Math.min(vw / TV_W, available / TV_H));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch("/api/pencil-status");
        const data = await r.json();
        setStatus(data.status || "idle");
        if (data.instruction) setLastInstruction(data.instruction);
      } catch {}
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const submit = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setStatus("pending");
    setLastInstruction(text);
    try {
      await fetch("/api/pencil-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: text }),
      });
    } catch {}
  };

  const statusDot = {
    idle: { bg: "#4ade80", label: "Ready" },
    pending: { bg: "#fbbf24", label: "Pending..." },
    done: { bg: "#4ade80", label: "Done" },
  }[status] || { bg: "#666", label: "" };

  return (
    <div style={{
      width: "100%", height: "100dvh", background: "#000",
      display: "flex", flexDirection: "column", alignItems: "center",
      overflow: "hidden", touchAction: "manipulation",
    }}>
      <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>

      {/* Status bar */}
      <div style={{
        width: "100%", height: STATUS_H, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 10px",
        background: "#111", borderBottom: "1px solid #222", flexShrink: 0,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          fontFamily: "system-ui, sans-serif", fontSize: 12, color: "#888",
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%", background: statusDot.bg,
            animation: status === "pending" ? "pulse 1.5s ease-in-out infinite" : "none",
          }} />
          <span>{statusDot.label}</span>
        </div>

        {/* View toggle */}
        <select
          value={view}
          onChange={e => setView(e.target.value)}
          style={{
            background: "#222", color: "#ccc", border: "1px solid #333",
            borderRadius: 4, padding: "3px 6px", fontSize: 11,
            fontFamily: "system-ui, sans-serif", outline: "none",
          }}
        >
          <option value="app">Live App</option>
          <option value="pencil">Pencil Design</option>
        </select>

        <button
          onClick={() => {
            if (view === "app") iframeRef.current?.contentWindow?.location.reload();
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
            }}>
              <PenPreview />
            </div>
          )}
        </div>
      </div>

      {/* Pencil edit input */}
      <div style={{
        width: "100%", height: INPUT_H, display: "flex", alignItems: "center",
        gap: 8, padding: "0 10px", background: "#111",
        borderTop: "1px solid #222", flexShrink: 0,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="Edit the Pencil design..."
          style={{
            flex: 1, height: 34, borderRadius: 6, border: "1px solid #333",
            background: "#1a1a1a", color: "#ccc", padding: "0 10px",
            fontFamily: "system-ui, sans-serif", fontSize: 14, outline: "none",
          }}
        />
        <button
          onClick={submit}
          style={{
            height: 34, padding: "0 14px", borderRadius: 6,
            border: "none", background: "#333", color: "#ccc",
            fontSize: 13, cursor: "pointer", fontFamily: "system-ui, sans-serif",
          }}
        >Send</button>
      </div>

      {/* Toast */}
      {status !== "idle" && lastInstruction && (
        <div style={{
          position: "absolute", bottom: INPUT_H + 8, left: 10, right: 10,
          padding: "8px 12px", borderRadius: 8, background: "#1a1a1a",
          border: `1px solid ${status === "pending" ? "#fbbf2440" : "#4ade8040"}`,
          color: status === "pending" ? "#fbbf24" : "#4ade80",
          fontSize: 12, fontFamily: "system-ui, sans-serif",
        }}>
          {status === "pending" ? "⏳" : "✓"} {lastInstruction}
        </div>
      )}
    </div>
  );
}
