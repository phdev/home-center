import { Image as ImageIcon, Loader2 } from "lucide-react";

export function KnowledgeHeroCard({ knowledge, config }) {
  const Icon = config.icon;
  return (
    <section className="knowledge-card knowledge-hero">
      <div className="knowledge-hero-copy">
        <div className="knowledge-type-pill">
          <Icon size={17} />
          {config.label}
        </div>
        <p className="knowledge-summary">{knowledge.summary}</p>
        <div className="knowledge-source">{knowledge.sourceLabel}</div>
      </div>
      <div className="knowledge-hero-visual">
        {knowledge.heroImage?.url ? (
          <img src={knowledge.heroImage.url} alt={knowledge.heroImage.alt} />
        ) : (
          <div className="knowledge-fallback-art">
            {knowledge.imagePending ? <Loader2 size={86} /> : <ImageIcon size={92} />}
          </div>
        )}
      </div>
    </section>
  );
}
