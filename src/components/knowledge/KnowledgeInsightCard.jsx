export function KnowledgeInsightCard({ insight }) {
  if (!insight?.body) return null;
  return (
    <section className="knowledge-card knowledge-card-pad">
      <h2 className="knowledge-card-title">{insight.title}</h2>
      <p className="knowledge-insight-body">{insight.body}</p>
    </section>
  );
}
