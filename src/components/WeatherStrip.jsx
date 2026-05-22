export function WeatherStrip({ t, weatherData }) {
  const current = weatherData?.current;
  const temp = current?.temp ?? 72;
  const icon = current?.icon ?? "☀️";
  const desc = current?.desc ?? "Sunny";
  const hi = current?.hi ?? 78;
  const lo = current?.lo ?? 62;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: "1.8rem" }}>{icon}</span>
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
          {temp}°
        </div>
        <div
          style={{
            fontFamily: t.bodyFont,
            fontSize: "0.7rem",
            color: t.textMuted,
          }}
        >
          {desc} · H:{hi}° L:{lo}°
        </div>
      </div>
    </div>
  );
}
