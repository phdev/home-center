export function Panel({ t, children, style = {}, noPad }) {
  return (
    <div
      style={{
        background: t.panelBg,
        backdropFilter: t.blur ? "blur(16px) saturate(1.4)" : undefined,
        WebkitBackdropFilter: t.blur ? "blur(16px) saturate(1.4)" : undefined,
        border: `1px solid ${t.panelBorder}`,
        borderRadius: t.radius,
        padding: noPad ? 0 : 18,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: t.shadow || "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function PanelHeader({ t, icon, label, right }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        fontFamily: t.bodyFont,
        fontSize: t.id === "terminal" ? "0.9rem" : "0.8rem",
        fontWeight: 600,
        color: t.textMuted,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        marginBottom: 10,
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: "1rem" }}>{icon}</span>
      <span>{t.id === "terminal" ? `> ${label}` : label}</span>
      {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
    </div>
  );
}
