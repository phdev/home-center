export function MetricDiagram({ metrics = [], accent = "#b993ff" }) {
  const items = metrics.length ? metrics.slice(0, 4) : [];
  return (
    <div className="knowledge-metrics">
      {items.map((metric, index) => (
        <div className="knowledge-metric" key={`${metric.label}-${index}`} style={{ borderColor: accent }}>
          <div className="knowledge-metric-value">{metric.value}</div>
          <div className="knowledge-metric-label">{metric.label}</div>
        </div>
      ))}
    </div>
  );
}
