export function Clock({ t, now }) {
  const time = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <span
      style={{
        fontFamily: t.monoFont || t.displayFont,
        fontSize: "2.2rem",
        fontWeight: 600,
        lineHeight: 1,
        color: t.text,
      }}
    >
      {time}
    </span>
  );
}
