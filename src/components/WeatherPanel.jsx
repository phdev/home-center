import { Panel, PanelHeader } from "./Panel";
import { HOURLY, DAILY } from "../data/mockData";

export function WeatherPanel({ t }) {
  const mx = Math.max(...HOURLY.map((h) => h.t));
  const mn = Math.min(...HOURLY.map((h) => h.t));
  const rng = mx - mn || 1;

  return (
    <Panel t={t}>
      <PanelHeader t={t} icon={"\u{1F324}\uFE0F"} label="Forecast" />
      <div style={{ display: "flex", gap: 2, alignItems: "flex-end", flex: 1 }}>
        {HOURLY.map((h, i) => {
          const bh = 12 + ((h.t - mn) / rng) * 34;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
              }}
            >
              <span
                style={{
                  fontFamily: t.bodyFont,
                  fontSize: "0.6rem",
                  fontWeight: 500,
                  color: t.text,
                }}
              >
                {h.t}°
              </span>
              <div
                style={{
                  width: "55%",
                  height: bh,
                  borderRadius: t.radius / 4,
                  background:
                    h.p > 20
                      ? "linear-gradient(to top,rgba(100,160,220,0.5),rgba(78,205,196,0.3))"
                      : "linear-gradient(to top,rgba(255,200,80,0.4),rgba(255,140,60,0.2))",
                  position: "relative",
                }}
              >
                {h.p > 20 && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: -13,
                      fontFamily: t.bodyFont,
                      fontSize: "0.5rem",
                      color: t.accent,
                      width: "100%",
                      textAlign: "center",
                    }}
                  >
                    {h.p}%
                  </span>
                )}
              </div>
              <span style={{ fontSize: "0.8rem", marginTop: 2 }}>{h.i}</span>
              <span
                style={{
                  fontFamily: t.bodyFont,
                  fontSize: "0.5rem",
                  color: t.textDim,
                }}
              >
                {h.h}
              </span>
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          gap: 4,
          paddingTop: 8,
          borderTop: `1px solid ${t.panelBorder}`,
          marginTop: 6,
        }}
      >
        {DAILY.map((d, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 5px",
              borderRadius: t.radius / 3,
              background: i === 0 ? `${t.accent}10` : "transparent",
            }}
          >
            <span
              style={{
                fontFamily: t.bodyFont,
                fontSize: "0.65rem",
                color: i === 0 ? t.text : t.textDim,
                minWidth: 28,
                fontWeight: i === 0 ? 600 : 400,
              }}
            >
              {d.d}
            </span>
            <span style={{ fontSize: "0.8rem" }}>{d.i}</span>
            <span
              style={{
                fontFamily: t.bodyFont,
                fontSize: "0.65rem",
                color: t.text,
              }}
            >
              {d.hi}°
            </span>
            <div
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                background: `${t.text}10`,
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: `${((d.lo - 50) / 40) * 100}%`,
                  width: `${((d.hi - d.lo) / 40) * 100}%`,
                  height: "100%",
                  borderRadius: 2,
                  background: `linear-gradient(90deg,${t.accent}80,${t.warm}80)`,
                }}
              />
            </div>
            <span
              style={{
                fontFamily: t.bodyFont,
                fontSize: "0.65rem",
                color: t.textDim,
              }}
            >
              {d.lo}°
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
