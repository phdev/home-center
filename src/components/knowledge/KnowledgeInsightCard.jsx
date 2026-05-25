import { Snowflake, Sparkle, Sprout } from "lucide-react";

function EarthLineArt() {
  return (
    <svg className="knowledge-insight-earth" viewBox="0 0 180 180" aria-hidden="true">
      <defs>
        <radialGradient id="knowledge-earth-glow" cx="36%" cy="31%" r="72%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="54%" stopColor="currentColor" stopOpacity="0.055" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
        <clipPath id="knowledge-earth-clip">
          <circle cx="90" cy="90" r="66" />
        </clipPath>
      </defs>
      <circle className="knowledge-earth-halo" cx="90" cy="90" r="78" />
      <circle className="knowledge-earth-fill" cx="90" cy="90" r="69" />
      <circle className="knowledge-earth-outline" cx="90" cy="90" r="66" />
      <g clipPath="url(#knowledge-earth-clip)">
        <path className="knowledge-earth-grid" d="M24 90h132" />
        <path className="knowledge-earth-grid" d="M31 64c36 10 78 10 118 0" />
        <path className="knowledge-earth-grid" d="M32 116c36-10 77-10 116 0" />
        <path className="knowledge-earth-grid knowledge-earth-grid-soft" d="M46 43c23 11 63 14 91 2" />
        <path className="knowledge-earth-grid knowledge-earth-grid-soft" d="M45 137c24-11 65-14 91-2" />
        <path className="knowledge-earth-grid" d="M90 24c-18 18-27 40-27 66s9 48 27 66" />
        <path className="knowledge-earth-grid" d="M90 24c18 18 27 40 27 66s-9 48-27 66" />
        <path className="knowledge-earth-grid knowledge-earth-grid-soft" d="M58 35c-8 34-8 76 0 110" />
        <path className="knowledge-earth-grid knowledge-earth-grid-soft" d="M122 35c8 34 8 76 0 110" />
        <path className="knowledge-earth-coast knowledge-earth-coast-major" d="M68 31c11-2 23 1 28 8 5 7 1 13 7 20 5 6 17 6 23 14 6 9 3 20-5 26-7 6-19 5-26 12-7 6-5 17-12 23-6 5-17 1-20-8-4-10 5-18 2-29-2-10-15-15-20-26-6-14 5-35 23-40Z" />
        <path className="knowledge-earth-coast" d="M79 33c-9 9-12 18-8 27 3 8 12 12 13 21 1 8-6 14-6 23 0 9 8 18 5 29" />
        <path className="knowledge-earth-coast" d="M98 69c7 5 12 12 13 21 1 8-3 14-11 18" />
        <path className="knowledge-earth-coast" d="M70 121c9 6 19 8 30 5" />
        <path className="knowledge-earth-coast knowledge-earth-coast-faint" d="M121 47c8 4 15 10 20 17" />
        <path className="knowledge-earth-coast knowledge-earth-coast-faint" d="M130 108c8-1 14-5 19-11" />
      </g>
      <circle className="knowledge-earth-dot" cx="36" cy="42" r="1.4" />
      <circle className="knowledge-earth-dot" cx="145" cy="38" r="1.15" />
      <circle className="knowledge-earth-dot" cx="152" cy="130" r="1.2" />
      <circle className="knowledge-earth-dot knowledge-earth-dot-soft" cx="30" cy="123" r="0.95" />
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
