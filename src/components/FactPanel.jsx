import { useState, useEffect } from "react";
import { Panel, PanelHeader } from "./Panel";
import { useCycler } from "../hooks/useCycler";
import { FACTS } from "../data/mockData";

export function FactPanel({ t }) {
  const [fact, factIndex] = useCycler(FACTS, 8000);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(false);
    const x = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(x);
  }, [factIndex]);

  return (
    <Panel
      t={t}
      style={{
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        gap: 6,
        background:
          t.id === "terminal"
            ? t.panelBg
            : `linear-gradient(135deg,${t.accent}08,${t.accent2}05)`,
      }}
    >
      <PanelHeader t={t} icon={"\u{1F4A1}"} label="Did You Know?" />
      <div
        style={{
          fontSize: "2.2rem",
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0.8)",
          transition: "all 0.5s",
        }}
      >
        {fact.e}
      </div>
      <div
        style={{
          fontFamily: t.displayFont,
          fontSize: t.id === "terminal" ? "1rem" : "0.95rem",
          fontWeight: 400,
          color: t.text,
          lineHeight: 1.5,
          maxWidth: 260,
          opacity: visible ? 1 : 0,
          transition: "all 0.5s ease 0.1s",
        }}
      >
        {fact.f}
      </div>
    </Panel>
  );
}
