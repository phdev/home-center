export function KnowledgeBottomBar({ config, relatedTopics }) {
  const Icon = config.icon;
  return (
    <footer className="knowledge-bottom-bar">
      <div className="knowledge-bottom-label">
        <Icon size={20} />
        {config.label}
      </div>
      <div className="knowledge-related">
        <span className="knowledge-related-label">Related Topics</span>
        {relatedTopics.map((topic) => (
          <span className="knowledge-chip" key={topic}>{topic}</span>
        ))}
      </div>
    </footer>
  );
}
