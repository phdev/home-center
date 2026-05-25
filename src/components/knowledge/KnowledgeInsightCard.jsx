import { Snowflake, Sparkle, Sprout } from "lucide-react";

const EARTH_LINE_GLOBE_URL = `${import.meta.env.BASE_URL}knowledge-assets/earth-line-globe.png`;

function EarthLineArt() {
  return (
    <svg className="knowledge-insight-earth" viewBox="0 0 180 180" aria-hidden="true">
      <image
        className="knowledge-earth-source"
        href={EARTH_LINE_GLOBE_URL}
        x="5"
        y="5"
        width="170"
        height="170"
        preserveAspectRatio="xMidYMid meet"
      />
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
  if (type === "person") {
    return (
      <div className="knowledge-insight-ornament knowledge-insight-ornament-person" aria-hidden="true">
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
