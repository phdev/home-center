export function Clock({ t, now }) {
  const time = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const date = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div style={{ textAlign: "right" }}>
      <div
        style={{
          fontFamily: t.displayFont,
          fontSize: t.id === "terminal" ? "2.8rem" : "2.4rem",
          fontWeight: t.id === "playroom" ? 800 : 600,
          lineHeight: 1,
          color: t.text,
        }}
      >
        {time}
      </div>
      <div
        style={{
          fontFamily: t.bodyFont,
          fontSize: "0.85rem",
          color: t.textMuted,
          marginTop: 3,
        }}
      >
        {date}
      </div>
    </div>
  );
}
