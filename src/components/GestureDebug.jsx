import { useState, useEffect } from "react";

const GESTURE_LABELS = {
  waveRight: "→ Wave R",
  waveLeft: "← Wave L",
  waveUp: "↑ Wave U",
  waveDown: "↓ Wave D",
  indexThumbPinch: "🤏 Idx Pinch",
  middleThumbPinch: "🤏 Mid Pinch",
  twoHandPinchIn: "⊏⊐ Pinch In",
  twoHandPinchOut: "⊐⊏ Pinch Out",
  pinchDragUp: "↑ Pinch Drag",
  pinchDragDown: "↓ Pinch Drag",
  thumbSwipeRight: "→ Thumb R",
  thumbSwipeLeft: "← Thumb L",
  thumbSwipeUp: "↑ Thumb U",
  thumbSwipeDown: "↓ Thumb D",
};

export function GestureDebug({ lastGesture }) {
  const [visible, setVisible] = useState(false);
  const [display, setDisplay] = useState(null);

  useEffect(() => {
    if (!lastGesture) return;
    setDisplay(lastGesture);
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(t);
  }, [lastGesture]);

  if (!display) return null;

  const label = GESTURE_LABELS[display.name] || display.name;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "6px 12px", borderRadius: 12,
      background: "#FFFFFF10", border: "1px solid #FFFFFF30",
      opacity: visible ? 1 : 0.3,
      transition: "opacity 500ms ease",
    }}>
      <span style={{
        fontFamily: "'JetBrains Mono',ui-monospace,monospace",
        fontSize: 13, fontWeight: 600, color: "#60A5FA",
        whiteSpace: "nowrap",
      }}>
        {label}
      </span>
      {display.hand && (
        <span style={{
          fontFamily: "'JetBrains Mono',ui-monospace,monospace",
          fontSize: 11, color: "#FFFFFF44",
        }}>
          {display.hand}
        </span>
      )}
    </div>
  );
}
