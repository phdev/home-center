import { Panel, PanelHeader } from "./Panel";
import { HOURLY, DAILY } from "../data/mockData";

export function WeatherPanel({ t, weatherData, loading, error }) {
  const hourly = weatherData?.hourly || HOURLY;
  const daily = weatherData?.daily || DAILY;
  const showMock = !weatherData;

  const mx = Math.max(...hourly.map((h) => h.t));
  const mn = Math.min(...hourly.map((h) => h.t));
  const rng = mx - mn || 1;

  return (
    <Panel t={t}>
      <PanelHeader
        t={t}
        icon={"🌤️"}
        label="Forecast"
        right={
          showMock && (
            <span
              style={{
                fontFamily: t.bodyFont,
                fontSize: "0.5rem",
                color: t.textDim,
                textTransform: "none",
                letterSpacing: 0,
              }}
            >
              demo
            </span>
          )
        }
      />
      {loading && (
        <div
          style={{
            fontFamily: t.bodyFont,
            fontSize: "0.75rem",
            color: t.textDim,
            padding: "12px 0",
            textAlign: "center",
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          Loading weather…
        </div>
      )}
      {error && (
        <div
          style={{
            fontFamily: t.bodyFont,
            fontSize: "0.7rem",
            color: t.warm,
            padding: "8px",
            background: `${t.warm}10`,
            borderRadius: t.radius / 3,
          }}
        >
          {error}
        </div>
      )}
      {!loading && (
        <>
          <div
            style={{
              display: "flex",
              gap: 2,
              alignItems: "flex-end",
              flex: 1,
            }}
          >
            {hourly.map((h, i) => {
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
                  <span style={{ fontSize: "0.8rem", marginTop: 2 }}>
                    {h.i}
                  </span>
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
            {daily.map((d, i) => (
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
        </>
      )}
    </Panel>
  );
}
