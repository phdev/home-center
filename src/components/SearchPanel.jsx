import { useState, useEffect, useRef } from "react";
import { Panel, PanelHeader } from "./Panel";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { SEARCH_SUGGESTIONS, CONVOS } from "../data/mockData";
import { askWithImage } from "../services/llm";

export function SearchPanel({ t, llmSettings }) {
  const [tab, setTab] = useState("ask");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const [interim, setInterim] = useState("");
  const [expanded, setExpanded] = useState(null);
  const endRef = useRef(null);
  const hasApiKey = !!llmSettings?.apiKey;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const send = async (text) => {
    const txt = (text || query).trim();
    if (!txt) return;
    setQuery("");
    setInterim("");
    setMessages((p) => [...p, { r: "u", t: txt }]);
    setTyping(true);

    if (hasApiKey) {
      try {
        const result = await askWithImage(
          txt,
          messages,
          llmSettings.apiKey,
          llmSettings.model,
          llmSettings.imageModel,
        );
        setTyping(false);
        setMessages((p) => [
          ...p,
          { r: "a", t: result.text, img: result.imageUrl },
        ]);
      } catch (e) {
        setTyping(false);
        setMessages((p) => [
          ...p,
          { r: "a", t: `Error: ${e.message}`, error: true },
        ]);
      }
    } else {
      setTimeout(() => {
        setTyping(false);
        setMessages((p) => [
          ...p,
          {
            r: "a",
            t: `Here's what I found about "${txt}": Add your OpenAI API key in Settings to get real answers with AI-generated images.`,
          },
        ]);
      }, 800);
    }
  };

  const voice = useVoiceInput({
    onResult: (f) => {
      setInterim("");
      send(f);
    },
    onInterim: (txt) => setInterim(txt),
  });

  const tabStyle = (id) => ({
    fontFamily: t.bodyFont,
    fontSize: "0.62rem",
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: t.radius / 3,
    background: tab === id ? `${t.accent}15` : "transparent",
    border: `1px solid ${tab === id ? t.accent + "25" : "transparent"}`,
    color: tab === id ? t.text : t.textDim,
    cursor: "pointer",
    transition: "all 0.2s",
  });

  return (
    <Panel t={t} style={{ height: "100%" }}>
      <PanelHeader
        t={t}
        icon={"✨"}
        label="Ask Anything"
        right={
          <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
            {voice.supported && voice.listening && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ display: "flex", gap: 2 }}>
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: 2,
                        borderRadius: 1,
                        background: t.accent,
                        animation: `waveBar 0.8s ease-in-out infinite alternate ${i * 0.06}s`,
                      }}
                    />
                  ))}
                </div>
                <span
                  style={{
                    fontFamily: t.bodyFont,
                    fontSize: "0.6rem",
                    color: t.accent,
                    fontWeight: 600,
                  }}
                >
                  Listening…
                </span>
              </div>
            )}
            <button onClick={() => setTab("ask")} style={tabStyle("ask")}>
              Ask
            </button>
            <button onClick={() => setTab("history")} style={tabStyle("history")}>
              History
            </button>
            {!hasApiKey && (
              <span
                style={{
                  fontFamily: t.bodyFont,
                  fontSize: "0.45rem",
                  color: t.textDim,
                  textTransform: "none",
                  letterSpacing: 0,
                }}
              >
                demo
              </span>
            )}
          </div>
        }
      />

      {tab === "ask" && (
        <>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 7,
              marginBottom: 8,
            }}
          >
            {messages.length === 0 && !voice.listening && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {SEARCH_SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setQuery(s)}
                    style={{
                      background: `${t.text}06`,
                      border: `1px solid ${t.panelBorder}`,
                      borderRadius: t.radius / 2,
                      padding: "6px 10px",
                      color: t.textMuted,
                      fontFamily: t.bodyFont,
                      fontSize: "0.75rem",
                      cursor: "pointer",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.r === "u" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                <div
                  style={{
                    background:
                      m.r === "u" ? `${t.accent}15` : `${t.text}06`,
                    border: `1px solid ${m.r === "u" ? t.accent + "20" : m.error ? t.warm + "30" : t.panelBorder}`,
                    borderRadius:
                      m.r === "u"
                        ? `${t.radius / 1.5}px ${t.radius / 1.5}px 3px ${t.radius / 1.5}px`
                        : `${t.radius / 1.5}px ${t.radius / 1.5}px ${t.radius / 1.5}px 3px`,
                    padding: "7px 12px",
                    fontFamily: t.bodyFont,
                    fontSize: "0.82rem",
                    color: m.error ? t.warm : t.text,
                    lineHeight: 1.5,
                  }}
                >
                  {m.t}
                </div>
                {m.img && (
                  <img
                    src={m.img}
                    alt=""
                    style={{
                      marginTop: 6,
                      width: "100%",
                      maxWidth: 280,
                      borderRadius: t.radius / 2,
                      border: `1px solid ${t.panelBorder}`,
                    }}
                  />
                )}
              </div>
            ))}
            {voice.listening && interim && (
              <div
                style={{
                  alignSelf: "flex-end",
                  padding: "7px 12px",
                  borderRadius: `${t.radius / 1.5}px ${t.radius / 1.5}px 3px ${t.radius / 1.5}px`,
                  background: `${t.accent}08`,
                  border: `1px dashed ${t.accent}30`,
                  fontFamily: t.bodyFont,
                  fontSize: "0.82rem",
                  color: t.textMuted,
                  fontStyle: "italic",
                  maxWidth: "85%",
                }}
              >
                {interim}…
              </div>
            )}
            {typing && (
              <div
                style={{
                  alignSelf: "flex-start",
                  padding: "7px 14px",
                  background: `${t.text}06`,
                  borderRadius: `${t.radius / 1.5}px ${t.radius / 1.5}px ${t.radius / 1.5}px 3px`,
                  border: `1px solid ${t.panelBorder}`,
                }}
              >
                <div style={{ display: "flex", gap: 4 }}>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: t.textMuted,
                        animation: `typingDot 1.2s ease infinite ${i * 0.2}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            {voice.supported && (
              <button
                onClick={voice.toggle}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: t.radius / 1.5,
                  border: "none",
                  background: voice.listening ? t.accent : t.inputBg,
                  color: voice.listening
                    ? t.id === "paper" || t.id === "playroom"
                      ? "#fff"
                      : "#0A0A0A"
                    : t.textMuted,
                  fontSize: "1rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  boxShadow: voice.listening
                    ? `0 0 16px ${t.accent}40`
                    : "none",
                  flexShrink: 0,
                  transition: "all 0.2s",
                }}
              >
                {voice.listening && (
                  <>
                    <div
                      style={{
                        position: "absolute",
                        inset: -4,
                        borderRadius: "50%",
                        border: `2px solid ${t.accent}40`,
                        animation: "voicePulse 1.5s ease-out infinite",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: -10,
                        borderRadius: "50%",
                        border: `1px solid ${t.accent}20`,
                        animation: "voicePulse 1.5s ease-out infinite 0.3s",
                      }}
                    />
                  </>
                )}
                {voice.listening ? "⏹" : "🎙️"}
              </button>
            )}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={
                voice.listening
                  ? "Listening…"
                  : t.id === "terminal"
                    ? "> query…"
                    : "Ask or tap 🎙️…"
              }
              style={{
                flex: 1,
                background: t.inputBg,
                border: `1px solid ${voice.listening ? t.accent + "50" : t.inputBorder}`,
                borderRadius: t.radius / 2,
                padding: "9px 12px",
                color: t.text,
                fontFamily: t.bodyFont,
                fontSize: "0.85rem",
                outline: "none",
                transition: "border-color 0.2s",
              }}
            />
            <button
              onClick={() => send()}
              style={{
                background: t.accent,
                border: "none",
                borderRadius: t.radius / 2,
                padding: "9px 16px",
                color:
                  t.id === "paper" || t.id === "playroom" ? "#fff" : "#0A0A0A",
                fontFamily: t.bodyFont,
                fontSize: "0.9rem",
                fontWeight: 700,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              →
            </button>
          </div>
        </>
      )}

      {tab === "history" && (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 5,
          }}
        >
          {CONVOS.map((c, i) => (
            <div
              key={i}
              onClick={() => setExpanded(expanded === i ? null : i)}
              style={{
                padding: "7px 9px",
                borderRadius: t.radius / 2.5,
                background: expanded === i ? `${t.accent}10` : `${t.text}04`,
                border: `1px solid ${expanded === i ? t.accent + "20" : t.panelBorder}`,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: 7 }}
              >
                <span style={{ fontSize: "1.15rem" }}>{c.av}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: t.bodyFont,
                      fontSize: "0.78rem",
                      fontWeight: 500,
                      color: t.text,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {c.q}
                  </div>
                  <div
                    style={{
                      fontFamily: t.bodyFont,
                      fontSize: "0.58rem",
                      color: t.textDim,
                    }}
                  >
                    {c.who} · {c.ts}
                  </div>
                </div>
              </div>
              {expanded === i && (
                <div
                  style={{
                    marginTop: 6,
                    padding: "6px 8px",
                    borderRadius: t.radius / 3,
                    background: `${t.accent}08`,
                    border: `1px solid ${t.accent}15`,
                  }}
                >
                  <div
                    style={{
                      fontFamily: t.bodyFont,
                      fontSize: "0.72rem",
                      color: t.textMuted,
                      lineHeight: 1.5,
                    }}
                  >
                    {c.a}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setTab("ask");
                      setQuery(c.q);
                    }}
                    style={{
                      marginTop: 4,
                      fontFamily: t.bodyFont,
                      fontSize: "0.6rem",
                      color: t.accent,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Ask again →
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
