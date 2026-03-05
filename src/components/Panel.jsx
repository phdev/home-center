export function Panel({ children, style = {}, selected = false }) {
  return (
    <div
      style={{
        borderRadius: 8,
        border: selected ? "5px solid #3B82F6" : "1px solid #FFFFFF",
        margin: selected ? -4 : 0,
        padding: 16,
        background: "transparent",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "border-width 150ms ease, margin 150ms ease",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function PanelHeader({ icon, label, subtitle, right }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
        flexShrink: 0,
      }}
    >
      {icon}
      <span
        style={{
          fontFamily: "'Geist','Inter',system-ui,sans-serif",
          fontSize: 24,
          fontWeight: 600,
          color: "#FFFFFF",
        }}
      >
        {label}
      </span>
      {subtitle && (
        <span
          style={{
            fontFamily: "'Geist','Inter',system-ui,sans-serif",
            fontSize: 16.5,
            color: "#FFFFFF66",
          }}
        >
          {subtitle}
        </span>
      )}
      {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
    </div>
  );
}
