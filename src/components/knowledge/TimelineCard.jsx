export function TimelineCard({ timeline, fallback, moduleStyle = "vertical-timeline" }) {
  const items = Array.isArray(timeline) ? timeline.slice(0, 4) : [];
  if (!items.length && fallback) return fallback;
  return (
    <section className={`knowledge-card knowledge-card-pad knowledge-timeline-card knowledge-module-${moduleStyle}`}>
      <h2 className="knowledge-card-title">Timeline</h2>
      {items.length ? (
        <div className="knowledge-timeline">
          {items.map((item, index) => (
            <div className="knowledge-timeline-item" key={`${item.date}-${item.label}-${index}`}>
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
