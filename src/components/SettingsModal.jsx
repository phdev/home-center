import { useState } from "react";

export function SettingsModal({ t, settings, onSave, onClose }) {
  const [local, setLocal] = useState(JSON.parse(JSON.stringify(settings)));
  const [newCalUrl, setNewCalUrl] = useState("");

  const update = (section, key, value) => {
    setLocal((prev) => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }));
  };

  const addCalUrl = () => {
    const url = newCalUrl.trim();
    if (!url) return;
    setLocal((prev) => ({
      ...prev,
      calendar: { ...prev.calendar, urls: [...prev.calendar.urls, url] },
    }));
    setNewCalUrl("");
  };

  const removeCalUrl = (idx) => {
    setLocal((prev) => ({
      ...prev,
      calendar: {
        ...prev.calendar,
        urls: prev.calendar.urls.filter((_, i) => i !== idx),
      },
    }));
  };

  const save = () => {
    onSave(local);
    onClose();
  };

  const labelStyle = {
    fontFamily: t.bodyFont,
    fontSize: "0.65rem",
    fontWeight: 600,
    color: t.textMuted,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 4,
    display: "block",
  };

  const inputStyle = {
    width: "100%",
    background: t.inputBg,
    border: `1px solid ${t.inputBorder}`,
    borderRadius: t.radius / 3,
    padding: "7px 10px",
    color: t.text,
    fontFamily: t.bodyFont,
    fontSize: "0.78rem",
    outline: "none",
    boxSizing: "border-box",
  };

  const sectionStyle = {
    marginBottom: 16,
    padding: "12px",
    borderRadius: t.radius / 2,
    background: `${t.text}04`,
    border: `1px solid ${t.panelBorder}`,
  };

  const sectionTitle = (icon, label) => (
    <div
      style={{
        fontFamily: t.bodyFont,
        fontSize: "0.8rem",
        fontWeight: 600,
        color: t.text,
        marginBottom: 10,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span style={{ fontSize: "1rem" }}>{icon}</span>
      {label}
    </div>
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99998,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(6px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: "min(480px, calc(100vw - 24px))",
          maxHeight: "85vh",
          background: t.panelBg,
          border: `1px solid ${t.panelBorder}`,
          borderRadius: t.radius,
          padding: "20px",
          overflowY: "auto",
          boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontFamily: t.displayFont,
              fontSize: "1.1rem",
              fontWeight: 700,
              color: t.text,
            }}
          >
            Settings
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: t.textDim,
              fontSize: "1.2rem",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        {/* Worker (server-side proxy) */}
        <div style={sectionStyle}>
          {sectionTitle("☁️", "Cloudflare Worker (recommended)")}
          <div
            style={{
              fontFamily: t.bodyFont,
              fontSize: "0.6rem",
              color: t.textDim,
              lineHeight: 1.5,
              marginBottom: 8,
            }}
          >
            When configured, all API calls route through your worker — no keys
            stored in the browser. Calendar, photos, and LLM credentials live
            server-side.
          </div>
          <label style={labelStyle}>Worker URL</label>
          <input
            value={local.worker.url}
            onChange={(e) => update("worker", "url", e.target.value.replace(/\/+$/, ""))}
            placeholder="https://home-center-api.yourname.workers.dev"
            style={{ ...inputStyle, marginBottom: 8 }}
          />
          <label style={labelStyle}>Auth Token (optional)</label>
          <input
            type="password"
            value={local.worker.token}
            onChange={(e) => update("worker", "token", e.target.value)}
            placeholder="Bearer token to authenticate with your worker"
            style={inputStyle}
          />
          {local.worker.url && (
            <div
              style={{
                marginTop: 8,
                fontFamily: t.bodyFont,
                fontSize: "0.58rem",
                color: t.accent,
                lineHeight: 1.5,
              }}
            >
              Worker mode active — calendar, photos & LLM sections below are
              only used as fallbacks if the worker is unavailable.
            </div>
          )}
        </div>

        {/* Weather */}
        <div style={sectionStyle}>
          {sectionTitle("🌤️", "Weather (Open-Meteo)")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <label style={labelStyle}>Latitude</label>
              <input
                type="number"
                step="0.001"
                value={local.weather.lat || ""}
                onChange={(e) => update("weather", "lat", parseFloat(e.target.value) || null)}
                placeholder="37.7749"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Longitude</label>
              <input
                type="number"
                step="0.001"
                value={local.weather.lng || ""}
                onChange={(e) => update("weather", "lng", parseFloat(e.target.value) || null)}
                placeholder="-122.4194"
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ ...labelStyle, marginBottom: 0, flex: 1 }}>
              <input
                type="checkbox"
                checked={local.weather.autoLocate}
                onChange={(e) => update("weather", "autoLocate", e.target.checked)}
                style={{ marginRight: 6 }}
              />
              Auto-detect location (if no lat/lng)
            </label>
            <select
              value={local.weather.units}
              onChange={(e) => update("weather", "units", e.target.value)}
              style={{ ...inputStyle, width: "auto" }}
            >
              <option value="fahrenheit">°F</option>
              <option value="celsius">°C</option>
            </select>
          </div>
        </div>

        {/* Calendar */}
        <div style={sectionStyle}>
          {sectionTitle("📅", "Calendar (iCloud / iCal)")}
          <label style={labelStyle}>iCal URLs (webcal:// or https://)</label>
          {local.calendar.urls.map((url, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
              <input
                value={url}
                readOnly
                style={{ ...inputStyle, flex: 1, fontSize: "0.65rem", color: t.textDim }}
              />
              <button
                onClick={() => removeCalUrl(i)}
                style={{
                  background: `${t.warm}15`,
                  border: `1px solid ${t.warm}30`,
                  borderRadius: t.radius / 3,
                  padding: "4px 8px",
                  color: t.warm,
                  fontFamily: t.bodyFont,
                  fontSize: "0.7rem",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={newCalUrl}
              onChange={(e) => setNewCalUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCalUrl()}
              placeholder="webcal://p123-caldav.icloud.com/published/2/..."
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              onClick={addCalUrl}
              style={{
                background: `${t.accent}15`,
                border: `1px solid ${t.accent}30`,
                borderRadius: t.radius / 3,
                padding: "4px 10px",
                color: t.accent,
                fontFamily: t.bodyFont,
                fontSize: "0.7rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Add
            </button>
          </div>
        </div>

        {/* Photos */}
        <div style={sectionStyle}>
          {sectionTitle("📸", "Photos (iCloud Shared Album)")}
          <label style={labelStyle}>Shared Album Token</label>
          <input
            value={local.photos.albumToken}
            onChange={(e) => update("photos", "albumToken", e.target.value)}
            placeholder="B0S5o3hGJMFRmw (from shared album URL)"
            style={{ ...inputStyle, marginBottom: 4 }}
          />
          <div
            style={{
              fontFamily: t.bodyFont,
              fontSize: "0.58rem",
              color: t.textDim,
              lineHeight: 1.5,
            }}
          >
            Share an album in Photos, enable "Public Website", copy the token
            from the URL.
          </div>
        </div>

        {/* LLM */}
        <div style={sectionStyle}>
          {sectionTitle("✨", "Ask Anything (OpenAI)")}
          <label style={labelStyle}>OpenAI API Key</label>
          <input
            type="password"
            value={local.llm.apiKey}
            onChange={(e) => update("llm", "apiKey", e.target.value)}
            placeholder="sk-..."
            style={{ ...inputStyle, marginBottom: 8 }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <label style={labelStyle}>Chat Model</label>
              <select
                value={local.llm.model}
                onChange={(e) => update("llm", "model", e.target.value)}
                style={inputStyle}
              >
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Image Model</label>
              <select
                value={local.llm.imageModel}
                onChange={(e) => update("llm", "imageModel", e.target.value)}
                style={inputStyle}
              >
                <option value="dall-e-3">DALL-E 3</option>
                <option value="dall-e-2">DALL-E 2</option>
              </select>
            </div>
          </div>
        </div>

        {/* CORS Proxy */}
        <div style={sectionStyle}>
          {sectionTitle("🔗", "CORS Proxy")}
          <label style={labelStyle}>
            Proxy URL (for iCloud calendar & photos)
          </label>
          <input
            value={local.calendar.corsProxy}
            onChange={(e) => {
              update("calendar", "corsProxy", e.target.value);
              update("photos", "corsProxy", e.target.value);
            }}
            placeholder="https://corsproxy.io/?"
            style={inputStyle}
          />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              background: `${t.text}08`,
              border: `1px solid ${t.panelBorder}`,
              borderRadius: t.radius / 2,
              padding: "8px 16px",
              color: t.textMuted,
              fontFamily: t.bodyFont,
              fontSize: "0.78rem",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={save}
            style={{
              background: t.accent,
              border: "none",
              borderRadius: t.radius / 2,
              padding: "8px 20px",
              color:
                t.id === "paper" || t.id === "playroom" ? "#fff" : "#0A0A0A",
              fontFamily: t.bodyFont,
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
