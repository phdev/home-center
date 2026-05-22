export function AtAGlanceCard({ glance }) {
  const metrics = Array.isArray(glance?.metrics) ? glance.metrics.slice(0, 4) : [];
  return (
    <section className="knowledge-card knowledge-card-pad">
      <h2 className="knowledge-card-title">{glance?.title || "At a Glance"}</h2>
      {glance?.description && <p className="knowledge-timeline-desc">{glance.description}</p>}
      {metrics.length ? (
        <div className="knowledge-metrics">
          {metrics.map((metric, index) => (
            <div className="knowledge-metric" key={`${metric.label}-${index}`}>
              <div className="knowledge-metric-value">{metric.value}</div>
              <div className="knowledge-metric-label">{metric.label}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="knowledge-muted">Related concepts unavailable</div>
      )}
    </section>
  );
}
