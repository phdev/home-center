import { Home } from "lucide-react";

const MEMBERS = [
  { id: "home", label: "Home", icon: true },
  { id: "peter", label: "Peter", initial: "P" },
  { id: "ali", label: "Ali", initial: "A" },
  { id: "lucy", label: "Lucy", initial: "L" },
  { id: "livy", label: "Livy", initial: "L" },
];

export function SideNav({ activeMember, onSelect }) {
  return (
    <div
      style={{
        width: 72,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        borderRight: "1px solid #FFFFFF30",
      }}
    >
      {MEMBERS.map((m) => {
        const active = activeMember === m.id;
        return (
          <div
            key={m.id}
            onClick={() => onSelect(m.id)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: active ? "#FFFFFF" : "transparent",
                border: active ? "none" : "2px solid #FFFFFF66",
                transition: "background 0.2s, border 0.2s",
              }}
            >
              {m.icon ? (
                <Home size={20} color={active ? "#000" : "#FFFFFF88"} />
              ) : (
                <span
                  style={{
                    fontFamily: "'Geist','Inter',system-ui,sans-serif",
                    fontSize: 16,
                    fontWeight: 600,
                    color: active ? "#000" : "#FFFFFF88",
                    lineHeight: 1,
                  }}
                >
                  {m.initial}
                </span>
              )}
            </div>
            <span
              style={{
                fontFamily: "'Geist','Inter',system-ui,sans-serif",
                fontSize: 11,
                fontWeight: 500,
                color: active ? "#FFFFFF" : "#FFFFFF66",
                transition: "color 0.2s",
              }}
            >
              {m.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
