export function KeyFactsCard({ facts }) {
  const items = Array.isArray(facts) ? facts.filter((fact) => fact.label && fact.value).slice(0, 6) : [];
  return (
    <section className="knowledge-card knowledge-card-pad">
      <h2 className="knowledge-card-title">Key Facts</h2>
      {items.length ? (
        <div className="knowledge-fact-list">
          {items.map((fact, index) => (
            <div className="knowledge-fact" key={`${fact.label}-${index}`}>
              <div className="knowledge-fact-label">{fact.label}</div>
              <div className="knowledge-fact-value">{fact.value}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="knowledge-muted">Facts unavailable</div>
      )}
    </section>
  );
}
