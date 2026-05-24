import { Loader2 } from "lucide-react";
import { heroCompositionClassNames } from "../../knowledge/visualPlanUtils";

function ConceptHeroVisual() {
  return (
    <div className="knowledge-concept-visual" aria-hidden="true">
      <div className="knowledge-concept-orbit knowledge-concept-orbit-a" />
      <div className="knowledge-concept-orbit knowledge-concept-orbit-b" />
      <div className="knowledge-concept-core" />
      <div className="knowledge-concept-stack knowledge-concept-stack-a" />
      <div className="knowledge-concept-stack knowledge-concept-stack-b" />
      <span className="knowledge-concept-node knowledge-concept-node-a" />
      <span className="knowledge-concept-node knowledge-concept-node-b" />
      <span className="knowledge-concept-node knowledge-concept-node-c" />
      <span className="knowledge-concept-node knowledge-concept-node-d" />
    </div>
  );
}

function shapeHeroSummary(summary = "") {
  const clean = String(summary || "").replace(/\s+/g, " ").trim();
  if (!clean) return { claim: "Knowledge answer", body: "" };
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];
  const claim = sentences[0]?.trim().slice(0, 210) || clean.slice(0, 210);
  const body = sentences.slice(1).join(" ").trim().slice(0, 190);
  return {
    claim,
    body: body && body !== claim ? body : "",
  };
}

export function KnowledgeHeroCard({ knowledge, config }) {
  const Icon = config.icon;
  const visualPlan = knowledge.visualPlan;
  const heroComposition = knowledge.heroComposition;
  const focalPoint = knowledge.heroImage?.focalPoint;
  const objectPosition = heroComposition?.composition?.objectPosition || (focalPoint
    ? `${Math.round(focalPoint.x * 100)}% ${Math.round(focalPoint.y * 100)}%`
    : undefined);
  const cropHint = knowledge.heroImage?.cropHint || "wide-landscape";
  const tone = knowledge.heroImage?.tone || "home-center-dark";
  const compositionClasses = heroCompositionClassNames(visualPlan);
  const motifKey = heroComposition?.motif?.assetKey || visualPlan.motifStrategy;
  const motifOpacity = heroComposition?.motif?.opacity;
  const heroText = shapeHeroSummary(knowledge.summary);
  return (
    <section className={`knowledge-card knowledge-hero ${compositionClasses}`}>
      <div className="knowledge-hero-copy">
        <div className="knowledge-type-pill">
          <Icon size={17} />
          {config.label}
        </div>
        <div>
          <p className="knowledge-summary">{heroText.claim}</p>
          {heroText.body && <p className="knowledge-hero-body">{heroText.body}</p>}
        </div>
        <div className="knowledge-source">{knowledge.sourceLabel}</div>
      </div>
      <div className={`knowledge-hero-visual knowledge-hero-visual-${cropHint} knowledge-hero-tone-${tone}`}>
        <div
          className={`knowledge-hero-motif knowledge-hero-motif-${motifKey}`}
          style={Number.isFinite(Number(motifOpacity)) ? { opacity: Number(motifOpacity) } : undefined}
        />
        {knowledge.heroImage?.url ? (
          <img
            src={knowledge.heroImage.url}
            alt={knowledge.heroImage.alt}
            style={objectPosition ? { objectPosition } : undefined}
          />
        ) : knowledge.type === "concept" && !knowledge.imagePending ? (
          <ConceptHeroVisual />
        ) : (
          <div className="knowledge-fallback-art">
            <div className="knowledge-fallback-orbit" />
            <div className="knowledge-fallback-mark">
              {knowledge.imagePending ? <Loader2 size={70} /> : <Icon size={76} />}
            </div>
            <Icon className="knowledge-fallback-ghost" size={128} />
          </div>
        )}
      </div>
    </section>
  );
}
