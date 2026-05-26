import { Snowflake, Sparkle } from "lucide-react";

const EARTH_LINE_GLOBE_URL = `${import.meta.env.BASE_URL}knowledge-assets/earth-line-globe.png`;
const ADA_LEGACY_LINEART_URL = `${import.meta.env.BASE_URL}knowledge-assets/ada-lovelace-legacy-yellow-lineart.png`;
const COAST_REDWOOD_ECOSYSTEM_SPRIG_URL = `${import.meta.env.BASE_URL}knowledge-assets/coast-redwood-ecosystem-sprig.png`;
const INTERNET_WWW_ORNAMENT_URL = `${import.meta.env.BASE_URL}knowledge-assets/internet-key-idea-www.svg`;

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

function LeafSprigLineArt() {
  return (
    <svg className="knowledge-insight-location-sprig" viewBox="0 0 220 180" aria-hidden="true">
      <path
        className="knowledge-location-sprig-stem"
        d="M112 168C116 132 113 98 98 67C91 52 82 39 70 27"
      />
      <path className="knowledge-location-sprig-stem" d="M112 168C137 130 154 92 162 48" />
      <path className="knowledge-location-sprig-stem" d="M112 168C89 135 68 106 40 84" />
      <path className="knowledge-location-sprig-leaf" d="M88 52C92 31 105 18 127 12C132 35 119 51 88 52Z" />
      <path className="knowledge-location-sprig-leaf" d="M124 84C132 60 150 45 178 40C180 69 161 85 124 84Z" />
      <path className="knowledge-location-sprig-leaf" d="M126 126C140 102 160 91 188 92C181 119 161 132 126 126Z" />
      <path className="knowledge-location-sprig-leaf" d="M83 96C59 93 44 80 36 57C63 52 81 66 83 96Z" />
      <path className="knowledge-location-sprig-leaf" d="M74 132C51 129 36 116 27 93C54 87 72 102 74 132Z" />
      <path className="knowledge-location-sprig-vein" d="M94 49C106 40 116 30 124 15" />
      <path className="knowledge-location-sprig-vein" d="M132 80C149 69 163 57 176 42" />
      <path className="knowledge-location-sprig-vein" d="M134 122C154 116 171 106 186 94" />
      <path className="knowledge-location-sprig-vein" d="M78 91C63 81 50 70 39 58" />
      <path className="knowledge-location-sprig-vein" d="M69 128C55 118 42 107 30 94" />
    </svg>
  );
}

function InsightOrnament({ type, title }) {
  if (type === "concept" && /\binternet\b/i.test(title || "")) {
    return (
      <div className="knowledge-insight-ornament knowledge-insight-ornament-concept" aria-hidden="true">
        <img className="knowledge-insight-internet-www" src={INTERNET_WWW_ORNAMENT_URL} alt="" />
      </div>
    );
  }
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
        <img
          className="knowledge-insight-legacy-lineart"
          src={ADA_LEGACY_LINEART_URL}
          alt=""
        />
      </div>
    );
  }
  if (type === "flora") {
    return (
      <div className="knowledge-insight-ornament knowledge-insight-ornament-flora" aria-hidden="true">
        <img className="knowledge-insight-flora-lineart" src={COAST_REDWOOD_ECOSYSTEM_SPRIG_URL} alt="" />
      </div>
    );
  }
  if (type === "location" && /\bmadagascar\b/i.test(title || "")) {
    return (
      <div className="knowledge-insight-ornament knowledge-insight-ornament-location" aria-hidden="true">
        <LeafSprigLineArt />
      </div>
    );
  }
  return null;
}

export function KnowledgeInsightCard({ insight, type, title }) {
  if (!insight?.body) return null;
  return (
    <section className={`knowledge-card knowledge-card-pad knowledge-insight-card knowledge-insight-card-${type || "default"}`}>
      <h2 className="knowledge-card-title">{insight.title}</h2>
      <p className="knowledge-insight-body">{insight.body}</p>
      <InsightOrnament type={type} title={title} />
    </section>
  );
}
