import { useState } from "react";
import {
  Bot,
  AlertTriangle,
  CalendarClock,
  Gift,
  Utensils,
  Sandwich,
  Moon,
  Mic,
  Send,
} from "lucide-react";
import { Panel, PanelHeader } from "../components/Panel";
import { GiftIdeasModal } from "./GiftIdeasModal";
import { useSettings } from "../hooks/useSettings";
import { useOpenClawThread } from "../hooks/useOpenClawThread";

const F = "'Geist','Inter',system-ui,sans-serif";
const EMOJI_FALLBACK = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji','Twemoji Mozilla',sans-serif";

const ICONS = {
  moon: Moon,
  "alert-triangle": AlertTriangle,
  "calendar-clock": CalendarClock,
  gift: Gift,
  utensils: Utensils,
  sandwich: Sandwich,
};

const MONO_ACCENT = {
  bg: "rgba(255, 255, 255, 0.06)",
  stroke: "rgba(255, 255, 255, 0.32)",
  tile: "rgba(255, 255, 255, 0.14)",
  ico: "#FFFFFF",
};

/**
 * Reads the already-ranked suggestions from derived state. OpenClaw may have
 * replaced `title`/`detail` via the `enhanced.items` field, matched by id.
 */
export function ClawSuggestionsCard({ derived, enhanced = {}, selected, onAction }) {
  const base = derived.clawSuggestions;
  const enhancedById = new Map((enhanced.items ?? []).map((i) => [i.id, i]));
  const { settings } = useSettings();
  const thread = useOpenClawThread(settings?.openclaw);
  const [giftModal, setGiftModal] = useState(null); // birthday view model or null
  const messages = thread.messages.length > 0 ? thread.messages : fallbackMessages;

  const handleClick = (s) => {
    if (s.actionKind === "orderGift" && s.targetRef?.birthdayId) {
      const b = (derived.birthdaysRanked ?? []).find(
        (x) => x.id === s.targetRef.birthdayId,
      );
      if (b) {
        setGiftModal(b);
        return;
      }
    }
    onAction?.(s);
  };

  return (
    <Panel selected={selected} selectedBorderColor="#FFFFFF" style={panelStyle}>
      <PanelHeader
        icon={
          <span style={avatarStyle}>
            <Bot size={17} color="#FFFFFF" />
          </span>
        }
        label="Howie OpenClaw"
        subtitle="Telegram"
        right={
          <span style={statusStyle}>{statusLabel(thread.status)}</span>
        }
      />
      <div style={threadStyle}>
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            tone={message.direction === "incoming" ? "voice" : "howie"}
            name={message.sender || (message.direction === "incoming" ? "Peter" : "Howie")}
            text={message.text}
            meta={message.meta || formatMessageTime(message.timestamp)}
          />
        ))}
      </div>

      <div style={composerStyle}>
        <Mic size={14} color="#FFFFFF" />
        <span style={composerTextStyle}>Say: Hey Howie, followed by your message</span>
        <Send size={14} color="#FFFFFFAA" />
      </div>

      <div style={suggestionsStyle}>
        {base.slice(0, 2).map((s) => {
          const e = enhancedById.get(s.id);
          const title = e?.title ?? s.title;
          const Ico = ICONS[s.iconName] ?? Bot;
          return (
            <button
              key={s.id}
              onClick={() => handleClick(s)}
              style={suggestionButtonStyle}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  background: MONO_ACCENT.tile,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Ico size={13} color={MONO_ACCENT.ico} />
              </span>
              <span style={suggestionTitleStyle}>{title}</span>
            </button>
          );
        })}
      </div>
      <GiftIdeasModal
        open={!!giftModal}
        birthday={giftModal}
        workerSettings={settings?.worker}
        onClose={() => setGiftModal(null)}
      />
    </Panel>
  );
}

const fallbackMessages = [
  {
    id: "fallback:howie",
    direction: "outgoing",
    sender: "Howie",
    text: "I am here. Say Hey Howie and I will send your message into Telegram.",
    meta: "waiting for Telegram",
  },
];

function statusLabel(status) {
  if (status === "connected") return "Live";
  if (status === "starting") return "Starting";
  if (status === "offline") return "Offline";
  return "Hey Howie";
}

function formatMessageTime(timestamp) {
  if (!timestamp) return "Telegram";
  const date = new Date(Number(timestamp) * 1000);
  if (Number.isNaN(date.getTime())) return "Telegram";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function MessageBubble({ tone, name, text, meta }) {
  const isVoice = tone === "voice";
  return (
    <div style={{ display: "flex", justifyContent: isVoice ? "flex-end" : "flex-start" }}>
      <div style={bubbleStyle(isVoice)}>
        <div style={bubbleNameStyle(isVoice)}>{name}</div>
        <div style={bubbleTextStyle}>{text}</div>
        <div style={bubbleMetaStyle}>{meta}</div>
      </div>
    </div>
  );
}

const panelStyle = {
  gap: 0,
};

const avatarStyle = {
  width: 30,
  height: 30,
  borderRadius: 999,
  background: "rgba(255, 255, 255, 0.14)",
  border: "1px solid rgba(255, 255, 255, 0.28)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const statusStyle = {
  display: "inline-flex",
  alignItems: "center",
  height: 24,
  padding: "0 9px",
  borderRadius: 999,
  background: "rgba(255, 255, 255, 0.08)",
  border: "1px solid rgba(255, 255, 255, 0.28)",
  color: "#FFFFFF",
  fontFamily: F,
  fontSize: 11,
  fontWeight: 700,
};

const threadStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  minHeight: 0,
  flex: 1,
  padding: "4px 0 10px",
  overflow: "hidden",
};

const bubbleStyle = (isVoice) => ({
  maxWidth: isVoice ? "86%" : "82%",
  padding: "9px 11px",
  borderRadius: isVoice ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
  background: isVoice ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 255, 255, 0.08)",
  border: `1px solid ${isVoice ? "rgba(255, 255, 255, 0.36)" : "rgba(255, 255, 255, 0.24)"}`,
  boxShadow: "0 10px 24px rgba(0,0,0,0.16)",
});

const bubbleNameStyle = (isVoice) => ({
  fontFamily: F,
  fontSize: 10,
  color: isVoice ? "#FFFFFF" : "rgba(255, 255, 255, 0.78)",
  fontWeight: 800,
  marginBottom: 3,
});

const bubbleTextStyle = {
  fontFamily: `${F},${EMOJI_FALLBACK}`,
  fontSize: 12.5,
  lineHeight: 1.28,
  color: "#FFFFFF",
  fontWeight: 550,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
};

const bubbleMetaStyle = {
  marginTop: 5,
  fontFamily: "'JetBrains Mono',ui-monospace,monospace",
  fontSize: 9.5,
  color: "#FFFFFF88",
};

const composerStyle = {
  minHeight: 34,
  borderRadius: 8,
  border: "1px solid rgba(148, 163, 184, 0.28)",
  background: "rgba(255, 255, 255, 0.06)",
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "0 10px",
  flexShrink: 0,
};

const composerTextStyle = {
  flex: 1,
  minWidth: 0,
  fontFamily: F,
  fontSize: 11.5,
  color: "rgba(255, 255, 255, 0.78)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const suggestionsStyle = {
  display: "flex",
  gap: 7,
  marginTop: 10,
  overflow: "hidden",
  flexWrap: "wrap",
  maxHeight: 92,
  flexShrink: 0,
};

const suggestionButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  minWidth: 0,
  maxWidth: "100%",
  padding: "6px 8px",
  borderRadius: 8,
  background: MONO_ACCENT.bg,
  border: `1px solid ${MONO_ACCENT.stroke}`,
  cursor: "pointer",
  textAlign: "left",
};

const suggestionTitleStyle = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontFamily: F,
  fontSize: 11.5,
  color: "#FFFFFF",
  fontWeight: 650,
};
