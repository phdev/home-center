import { useState, useEffect } from "react";
import { Sparkles, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Panel, PanelHeader } from "./Panel";
import { useCycler } from "../hooks/useCycler";
import { FACTS } from "../data/mockData";

const F = "'Geist','Inter',system-ui,sans-serif";
// Telegram deep link to the family OpenClaw bot (@howellfelton_bot on Telegram).
const QR_URL = "https://t.me/howellfelton_bot?start=hello";

export function FactPanel({ t, selected }) {
  const [fact, factIndex] = useCycler(FACTS, 8000);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(false);
    const x = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(x);
  }, [factIndex]);

  return (
    <Panel selected={selected}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <PanelHeader
            icon={<Sparkles size={30} color="#FFFFFF" />}
            label="Fun Fact of the Day"
          />
          <span
            style={{
              fontFamily: F,
              fontSize: 21,
              color: "#FFFFFFCC",
              lineHeight: 1.5,
              opacity: visible ? 1 : 0,
              transition: "opacity 0.5s",
            }}
          >
            {fact.f}
          </span>
          <span
            style={{
              fontFamily: F,
              fontSize: 16.5,
              color: "#FFFFFF44",
              marginTop: 4,
              opacity: visible ? 1 : 0,
              transition: "opacity 0.5s ease 0.1s",
            }}
          >
            — {fact.s}
          </span>
        </div>
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
          }}
        >
          <div
            style={{
              padding: 6,
              background: "#FFFFFF",
              borderRadius: 6,
              lineHeight: 0,
            }}
          >
            <QRCodeSVG value={QR_URL} size={72} level="M" />
          </div>
          <span
            style={{
              fontFamily: F,
              fontSize: 11,
              color: "#FFFFFF44",
              textAlign: "center",
            }}
          >
            Chat with OpenClaw
          </span>
        </div>
      </div>
    </Panel>
  );
}
