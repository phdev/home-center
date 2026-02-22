export function WeatherStrip({ t }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: "1.8rem" }}>{"\u2600\uFE0F"}</span>
      <div>
        <div
          style={{
            fontFamily: t.displayFont,
            fontSize: "1.8rem",
            fontWeight: 600,
            color: t.text,
            lineHeight: 1,
          }}
        >
          72°
        </div>
        <div
          style={{
            fontFamily: t.bodyFont,
            fontSize: "0.7rem",
            color: t.textMuted,
          }}
        >
          Sunny · H:78° L:62°
        </div>
      </div>
    </div>
  );
}
