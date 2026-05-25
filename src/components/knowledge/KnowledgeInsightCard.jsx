import { Snowflake, Sparkle, Sprout } from "lucide-react";

function EarthLineArt() {
  return (
    <svg className="knowledge-insight-earth" viewBox="0 0 160 160" aria-hidden="true">
      <defs>
        <radialGradient id="knowledge-earth-glow" cx="42%" cy="34%" r="68%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
          <stop offset="58%" stopColor="currentColor" stopOpacity="0.05" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
        <clipPath id="knowledge-earth-clip">
          <circle cx="80" cy="80" r="66" />
        </clipPath>
      </defs>
      <circle className="knowledge-earth-fill" cx="80" cy="80" r="68" />
      <circle className="knowledge-earth-outline" cx="80" cy="80" r="66" />
      <g clipPath="url(#knowledge-earth-clip)">
        <path className="knowledge-earth-grid" d="M14 80h132" />
        <path className="knowledge-earth-grid" d="M24 51c35 10 73 10 112 0" />
        <path className="knowledge-earth-grid" d="M24 109c35-10 73-10 112 0" />
        <path className="knowledge-earth-grid" d="M80 14c-17 17-26 39-26 66s9 49 26 66" />
        <path className="knowledge-earth-grid" d="M80 14c17 17 26 39 26 66s-9 49-26 66" />
        <path className="knowledge-earth-grid knowledge-earth-grid-soft" d="M42 28c-9 34-9 70 0 104" />
        <path className="knowledge-earth-grid knowledge-earth-grid-soft" d="M118 28c9 34 9 70 0 104" />
        <path className="knowledge-earth-coast" d="M49 35c12-7 29-7 41 1 8 5 11 13 6 21-5 8-17 8-25 14-9 7-7 18-18 22-11 4-24-6-25-19-1-15 7-29 21-39Z" />
        <path className="knowledge-earth-coast" d="M95 70c11-5 27-2 35 8 7 8 5 20-4 26-9 6-20-1-28 5-6 5-6 15-15 16-10 1-18-8-16-19 2-15 14-29 28-36Z" />
      </g>
    </svg>
  );
}

function FeatherLineArt() {
  return (
    <svg className="knowledge-insight-feather" viewBox="0 0 210 150" aria-hidden="true">
      <path
        className="knowledge-feather-outline"
        d="M38 122C70 77 106 37 157 18c24-9 39-2 35 18-7 42-65 87-130 96"
      />
      <path className="knowledge-feather-spine" d="M41 125C84 93 124 61 175 25" />
      <path className="knowledge-feather-barb" d="M76 96c3-20 3-34-2-48" />
      <path className="knowledge-feather-barb" d="M98 79c6-24 8-41 6-58" />
      <path className="knowledge-feather-barb" d="M121 62c7-18 14-31 25-43" />
      <path className="knowledge-feather-barb" d="M72 100c24 2 47-1 70-8" />
      <path className="knowledge-feather-barb" d="M96 82c24 0 47-4 70-14" />
      <path className="knowledge-feather-barb" d="M119 64c18-2 36-8 54-18" />
    </svg>
  );
}

function InsightOrnament({ type }) {
  if (type === "event") {
    return (
      <div className="knowledge-insight-ornament knowledge-insight-ornament-event" aria-hidden="true">
        <EarthLineArt />
        <Sparkle className="knowledge-insight-star knowledge-insight-star-a" size={15} />
        <Sparkle className="knowledge-insight-star knowledge-insight-star-b" size={11} />
        <Sparkle className="knowledge-insight-star knowledge-insight-star-c" size={9} />
      </div>
    );
  }
  if (type === "fauna") {
    return (
      <div className="knowledge-insight-ornament knowledge-insight-ornament-fauna" aria-hidden="true">
        <Snowflake className="knowledge-insight-snowflake knowledge-insight-snowflake-a" size={25} />
        <Snowflake className="knowledge-insight-snowflake knowledge-insight-snowflake-b" size={18} />
        <Snowflake className="knowledge-insight-snowflake knowledge-insight-snowflake-c" size={15} />
        <FeatherLineArt />
      </div>
    );
  }
  if (type === "flora") {
    return (
      <div className="knowledge-insight-ornament knowledge-insight-ornament-flora" aria-hidden="true">
        <Sprout className="knowledge-insight-sprout" size={112} />
      </div>
    );
  }
  return null;
}

export function KnowledgeInsightCard({ insight, type }) {
  if (!insight?.body) return null;
  return (
    <section className={`knowledge-card knowledge-card-pad knowledge-insight-card knowledge-insight-card-${type || "default"}`}>
      <h2 className="knowledge-card-title">{insight.title}</h2>
      <p className="knowledge-insight-body">{insight.body}</p>
      <InsightOrnament type={type} />
    </section>
  );
}
