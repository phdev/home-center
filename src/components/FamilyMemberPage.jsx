const MEMBER_INFO = {
  peter: { name: "Peter", color: "#60A5FA", initial: "P" },
  ali: { name: "Ali", color: "#F472B6", initial: "A" },
  lucy: { name: "Lucy", color: "#A78BFA", initial: "L" },
  livy: { name: "Livy", color: "#34D399", initial: "L" },
};

export function FamilyMemberPage({ member }) {
  const info = MEMBER_INFO[member];
  if (!info) return null;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: info.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: "'Geist','Inter',system-ui,sans-serif",
            fontSize: 56,
            fontWeight: 700,
            color: "#000",
            lineHeight: 1,
          }}
        >
          {info.initial}
        </span>
      </div>
      <span
        style={{
          fontFamily: "'Geist','Inter',system-ui,sans-serif",
          fontSize: 32,
          fontWeight: 700,
          color: "#FFFFFF",
        }}
      >
        {info.name}
      </span>
      <span
        style={{
          fontFamily: "'Geist','Inter',system-ui,sans-serif",
          fontSize: 16,
          color: "#FFFFFF66",
        }}
      >
        Coming soon
      </span>
    </div>
  );
}
