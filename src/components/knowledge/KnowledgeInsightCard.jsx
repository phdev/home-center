import { Snowflake, Sparkle, Sprout } from "lucide-react";

function EarthLineArt() {
  return (
    <svg className="knowledge-insight-earth" viewBox="0 0 160 160" aria-hidden="true">
      <defs>
        <radialGradient id="knowledge-earth-glow" cx="42%" cy="34%" r="68%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="58%" stopColor="currentColor" stopOpacity="0.07" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle className="knowledge-earth-fill" cx="80" cy="80" r="68" />
      <circle className="knowledge-earth-outline" cx="80" cy="80" r="66" />
      <path className="knowledge-earth-line" d="M23 77c15-7 29-8 43-2 13 5 24 4 36-3 12-8 24-9 36-5" />
      <path className="knowledge-earth-line" d="M32 46c12 6 25 8 39 5 14-4 27-2 40 6 7 4 14 6 22 5" />
      <path className="knowledge-earth-line" d="M42 111c12-7 25-8 39-3 15 6 31 4 47-7" />
      <path className="knowledge-earth-land" d="M53 38c10-8 24-10 35-3 6 4 8 10 4 16-5 7-17 6-24 12-8 7-3 17-13 21-11 4-22-4-23-16-1-11 8-21 21-30Z" />
      <path className="knowledge-earth-land" d="M94 70c9-5 23-3 30 5 6 7 5 17-2 22-8 6-19-1-26 5-5 4-5 13-13 14-8 1-15-6-14-15 2-13 13-25 25-31Z" />
      <path className="knowledge-earth-line" d="M80 15c-15 18-23 40-23 65s8 47 23 65" />
      <path className="knowledge-earth-line" d="M80 15c15 18 23 40 23 65s-8 47-23 65" />
      <path className="knowledge-earth-line" d="M19 80h122" />
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
