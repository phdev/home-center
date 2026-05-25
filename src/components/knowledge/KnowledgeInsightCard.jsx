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
      <g clipPath="url(#knowledge-earth-clip)" transform="rotate(-15 90 90)">
        <g className="knowledge-earth-grid-set">
          <path className="knowledge-earth-grid" d="M24 90h132" />
          <path className="knowledge-earth-grid" d="M30 68c38 9 82 9 120 0" />
          <path className="knowledge-earth-grid" d="M30 112c38-9 82-9 120 0" />
          <path className="knowledge-earth-grid knowledge-earth-grid-soft" d="M42 48c28 11 68 11 96 0" />
          <path className="knowledge-earth-grid knowledge-earth-grid-soft" d="M42 132c28-11 68-11 96 0" />
          <path className="knowledge-earth-grid knowledge-earth-grid-soft" d="M90 24v132" />
          <path className="knowledge-earth-grid" d="M90 24c-17 18-25 40-25 66s8 48 25 66" />
          <path className="knowledge-earth-grid" d="M90 24c17 18 25 40 25 66s-8 48-25 66" />
          <path className="knowledge-earth-grid knowledge-earth-grid-soft" d="M58 36c-8 33-8 75 0 108" />
          <path className="knowledge-earth-grid knowledge-earth-grid-soft" d="M122 36c8 33 8 75 0 108" />
        </g>
        <g className="knowledge-earth-contours">
          <path className="knowledge-earth-coast knowledge-earth-coast-major" d="M65 35c10-6 24-7 35-1 8 4 12 10 10 17-2 8-13 9-15 17-2 7 8 11 9 19 1 7-6 10-11 14-7 5-8 13-5 21 3 7 0 14-8 16-9 2-17-7-17-18 0-8 6-15 3-22-3-8-15-10-20-18-8-14 2-35 19-45Z" />
          <path className="knowledge-earth-coast" d="M57 52c7-3 15-3 22 1" />
          <path className="knowledge-earth-coast" d="M79 37c-8 10-11 19-8 28 3 7 10 11 11 18" />
          <path className="knowledge-earth-coast" d="M93 57c8 4 15 8 20 15 6 8 5 17-1 24" />
          <path className="knowledge-earth-coast" d="M74 103c-5 6-6 15-1 23" />
          <path className="knowledge-earth-coast" d="M84 129c7 3 15 2 22-4" />
          <path className="knowledge-earth-coast knowledge-earth-coast-faint" d="M116 39c12 4 22 11 29 22" />
          <path className="knowledge-earth-coast knowledge-earth-coast-faint" d="M124 79c11 5 18 13 20 24" />
          <path className="knowledge-earth-coast knowledge-earth-coast-faint" d="M123 124c10-2 18-7 24-15" />
        </g>
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
