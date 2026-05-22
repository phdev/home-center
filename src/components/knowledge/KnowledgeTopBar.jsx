import { ArrowLeft } from "lucide-react";
import { useTime } from "../../hooks/useTime";
import { GlassesIndicator } from "../GlassesIndicator";
import { GestureDebug } from "../GestureDebug";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function KnowledgeTopBar({ title, query, config, onBack, handControllerConnected, lastGesture }) {
  const now = useTime();
  const Icon = config.icon;
  const hour = now.getHours() % 12 || 12;
  const minute = String(now.getMinutes()).padStart(2, "0");
  const ampm = now.getHours() >= 12 ? "PM" : "AM";
  const date = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;

  return (
    <header className="knowledge-topbar">
      <button className="knowledge-back" onClick={onBack} aria-label="Back">
        <ArrowLeft size={30} />
        <Icon size={26} color={config.accent} />
        <span className="knowledge-title">{title}</span>
      </button>
      <div className="knowledge-query">{query ? `"${query}"` : ""}</div>
      <div className="knowledge-clock">
        <GestureDebug lastGesture={lastGesture} />
        <GlassesIndicator connected={handControllerConnected} />
        <span className="knowledge-date">{date}</span>
        <span className="knowledge-time">{hour}:{minute} {ampm}</span>
      </div>
    </header>
  );
}
