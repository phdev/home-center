import { Glasses } from "lucide-react";

export function GlassesIndicator({ connected }) {
  if (!connected) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "6px 10px", borderRadius: 12,
      background: "#FFFFFF10", border: "1px solid #FFFFFF30",
    }}>
      <Glasses size={20} color="#4ADE80" />
    </div>
  );
}
