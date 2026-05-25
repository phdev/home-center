import { Footprints, Rocket, Satellite, Umbrella } from "lucide-react";

function TimelineIcon({ label = "", index }) {
  const value = label.toLowerCase();
  if (value.includes("launch")) return <Rocket size={30} />;
  if (value.includes("landing")) return <Satellite size={30} />;
  if (value.includes("moonwalk")) return <Footprints size={30} />;
  if (value.includes("return")) return <Umbrella size={30} />;
  return String(index + 1).padStart(2, "0");
}

export function TimelineCard({ timeline, fallback, moduleStyle = "vertical-timeline" }) {
  const items = Array.isArray(timeline) ? timeline.slice(0, 4) : [];
  if (!items.length && fallback) return fallback;
  const title = moduleStyle === "horizontal-mission-timeline" ? "At a Glance" : "Timeline";
  return (
    <section className={`knowledge-card knowledge-card-pad knowledge-timeline-card knowledge-module-${moduleStyle}`}>
      <h2 className="knowledge-card-title">{title}</h2>
      {items.length ? (
        <div className="knowledge-timeline">
          {items.map((item, index) => (
            <div className="knowledge-timeline-item" key={`${item.date}-${item.label}-${index}`}>
              <div className="knowledge-timeline-icon" aria-hidden="true">
                <TimelineIcon label={item.label} index={index} />
              </div>
              {moduleStyle === "horizontal-mission-timeline" && index < items.length - 1 && <span className="knowledge-timeline-connector" aria-hidden="true" />}
              <div className="knowledge-timeline-date">{item.date || item.label}</div>
              <div>
                <div className="knowledge-timeline-label">{item.label}</div>
                {item.description && <div className="knowledge-timeline-desc">{item.description}</div>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="knowledge-muted">Timeline unavailable</div>
      )}
    </section>
  );
}
