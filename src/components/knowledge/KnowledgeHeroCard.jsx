import { Image as ImageIcon, Loader2 } from "lucide-react";

export function KnowledgeHeroCard({ knowledge, config }) {
  const Icon = config.icon;
  const focalPoint = knowledge.heroImage?.focalPoint;
  const objectPosition = focalPoint
    ? `${Math.round(focalPoint.x * 100)}% ${Math.round(focalPoint.y * 100)}%`
    : undefined;
  const cropHint = knowledge.heroImage?.cropHint || "wide-landscape";
  const tone = knowledge.heroImage?.tone || "home-center-dark";
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
      <div className={`knowledge-hero-visual knowledge-hero-visual-${cropHint} knowledge-hero-tone-${tone}`}>
        {knowledge.heroImage?.url ? (
          <img
            src={knowledge.heroImage.url}
            alt={knowledge.heroImage.alt}
            style={objectPosition ? { objectPosition } : undefined}
          />
        ) : (
          <div className="knowledge-fallback-art">
            <div className="knowledge-fallback-orbit" />
            <div className="knowledge-fallback-mark">
              {knowledge.imagePending ? <Loader2 size={70} /> : <Icon size={76} />}
            </div>
            <ImageIcon className="knowledge-fallback-ghost" size={128} />
          </div>
        )}
      </div>
    </section>
  );
}
