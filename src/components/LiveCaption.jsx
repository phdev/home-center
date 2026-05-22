import { useEffect, useRef, useState } from "react";
import { AudioLines } from "lucide-react";

const COMPLETE_HOLD_MS = 700;
const SPHERE_SIZE = 68;
const SPHERE_ANIMATION_MS = 180;
const CLOSED_SCALE = 1 / SPHERE_SIZE;

export function LiveCaption({ text, isWake, stage }) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [open, setOpen] = useState(false);
  const hideRef = useRef(null);
  const openRef = useRef(null);

  const active = stage === "listening" || stage === "verifying";
  const hasCaption = !!String(text || "").trim() || active;
  const highlighted = isWake || active;

  useEffect(() => {
    if (openRef.current) {
      cancelAnimationFrame(openRef.current);
      openRef.current = null;
    }
    if (hideRef.current) {
      clearTimeout(hideRef.current);
      hideRef.current = null;
    }

    if (hasCaption) {
      setVisible(true);
      setClosing(false);
      setOpen(false);
      openRef.current = requestAnimationFrame(() => setOpen(true));
      if (!active) {
        hideRef.current = setTimeout(() => {
          setClosing(true);
          setOpen(false);
          hideRef.current = setTimeout(() => setVisible(false), SPHERE_ANIMATION_MS);
        }, COMPLETE_HOLD_MS);
      }
      return () => {
        if (openRef.current) cancelAnimationFrame(openRef.current);
        if (hideRef.current) clearTimeout(hideRef.current);
      };
    }

    if (visible) {
      hideRef.current = setTimeout(() => {
        setClosing(true);
        setOpen(false);
        hideRef.current = setTimeout(() => setVisible(false), SPHERE_ANIMATION_MS);
      }, COMPLETE_HOLD_MS);
    }

    return () => {
      if (openRef.current) cancelAnimationFrame(openRef.current);
      if (hideRef.current) clearTimeout(hideRef.current);
    };
  }, [active, hasCaption, visible]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 36,
        height: 88,
        zIndex: 10001,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        contain: "layout paint style",
      }}
    >
      <div
        style={{
          width: SPHERE_SIZE,
          height: SPHERE_SIZE,
          borderRadius: "50%",
          background: highlighted
            ? "radial-gradient(circle at 30% 25%, #60A5FA 0%, #2563EB 62%, #172554 100%)"
            : "rgba(10, 15, 30, 0.92)",
          border: highlighted ? "1.5px solid rgba(147,197,253,0.9)" : "1px solid rgba(255,255,255,0.18)",
          boxShadow: highlighted
            ? "0 0 16px rgba(59,130,246,0.28), 0 6px 14px rgba(0,0,0,0.34)"
            : "0 6px 14px rgba(0,0,0,0.32)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: open && !closing ? 1 : 0,
          overflow: "hidden",
          transform: `translate3d(0, 0, 0) scale(${open && !closing ? 1 : CLOSED_SCALE})`,
          transformOrigin: "50% 50%",
          transition: `transform ${SPHERE_ANIMATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${SPHERE_ANIMATION_MS}ms linear`,
          willChange: "transform, opacity",
          backfaceVisibility: "hidden",
        }}
      >
        <AudioLines size={31} color="#FFFFFF" strokeWidth={2.3} />
      </div>
    </div>
  );
}
