import { useState, useEffect } from "react";
import { Panel } from "./Panel";
import { useCycler } from "../hooks/useCycler";
import { PHOTOS } from "../data/mockData";

export function PhotoPanel({ t }) {
  const [photo, photoIndex] = useCycler(PHOTOS, 6000);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    setFade(false);
    const x = setTimeout(() => setFade(true), 50);
    return () => clearTimeout(x);
  }, [photoIndex]);

  return (
    <Panel t={t} noPad style={{ position: "relative" }}>
      <img
        src={photo.url}
        alt=""
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: fade ? 1 : 0,
          transition: "opacity 0.8s",
          borderRadius: t.radius,
          ...(t.id === "terminal"
            ? { filter: "grayscale(0.6) contrast(1.2) brightness(0.8)" }
            : {}),
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background:
            t.id === "paper"
              ? "linear-gradient(transparent,rgba(245,240,232,0.9))"
              : "linear-gradient(transparent,rgba(10,10,15,0.85))",
          padding: "24px 14px 10px",
          borderRadius: `0 0 ${t.radius}px ${t.radius}px`,
        }}
      >
        <div
          style={{
            fontFamily: t.bodyFont,
            fontSize: "0.8rem",
            color: t.id === "paper" ? t.text : "#F0EDE6",
          }}
        >
          {photo.cap}
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
          {PHOTOS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === photoIndex ? 16 : 5,
                height: 5,
                borderRadius: 3,
                background:
                  i === photoIndex
                    ? t.id === "paper"
                      ? t.text
                      : "#F0EDE6"
                    : `${t.id === "paper" ? t.text : "#F0EDE6"}40`,
                transition: "all 0.3s",
              }}
            />
          ))}
        </div>
      </div>
    </Panel>
  );
}
