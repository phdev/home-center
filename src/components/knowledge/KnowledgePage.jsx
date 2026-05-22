import { normalizeKnowledgeResponse } from "../../knowledge/normalizeKnowledgeResponse";
import { getKnowledgeTypeConfig } from "../../knowledge/typeConfig";
import { AtAGlanceCard } from "./AtAGlanceCard";
import { KeyFactsCard } from "./KeyFactsCard";
import { KnowledgeBottomBar } from "./KnowledgeBottomBar";
import { KnowledgeHeroCard } from "./KnowledgeHeroCard";
import { KnowledgeInsightCard } from "./KnowledgeInsightCard";
import { KnowledgeMapCard } from "./KnowledgeMapCard";
import { KnowledgeTopBar } from "./KnowledgeTopBar";
import { PlacesCard } from "./PlacesCard";
import { ProcessDiagramCard } from "./ProcessDiagramCard";
import { TimelineCard } from "./TimelineCard";
import "./KnowledgePage.css";

function MiddleCard({ knowledge, config }) {
  if (knowledge.type === "person") {
    return <TimelineCard timeline={knowledge.timeline} fallback={<AtAGlanceCard glance={knowledge.glance} />} />;
  }
  if (knowledge.type === "event") {
    return <PlacesCard maps={knowledge.maps} accent={config.accent} />;
  }
  if (knowledge.type === "concept") {
    return <ProcessDiagramCard type={knowledge.type} glance={knowledge.glance} accent={config.accent} />;
  }
  return <KnowledgeMapCard maps={knowledge.maps} accent={config.accent} />;
}

function LowerCard({ knowledge, config }) {
  if (knowledge.type === "event") {
    return <TimelineCard timeline={knowledge.timeline} fallback={<AtAGlanceCard glance={knowledge.glance} />} />;
  }
  if (knowledge.type === "concept") {
    return <AtAGlanceCard glance={knowledge.glance} />;
  }
  if (knowledge.type === "fauna" || knowledge.type === "flora") {
    return knowledge.glance.metrics.length
      ? <AtAGlanceCard glance={knowledge.glance} />
      : <ProcessDiagramCard type={knowledge.type} glance={knowledge.glance} accent={config.accent} />;
  }
  return <AtAGlanceCard glance={knowledge.glance} />;
}

export function KnowledgePage({ response, onBack, handControllerConnected, lastGesture }) {
  if (!response) return null;
  const knowledge = normalizeKnowledgeResponse(response);
  const config = getKnowledgeTypeConfig(knowledge.type);

  return (
    <div
      className="hc-full-page knowledge-page"
      style={{
        "--knowledge-accent": config.accent,
        "--knowledge-accent-soft": config.accentSoft,
      }}
    >
      <div className="hc-full-page-bg" />
      <div className="hc-full-page-veil" />
      <KnowledgeTopBar
        title={knowledge.title}
        query={knowledge.query}
        config={config}
        onBack={onBack}
        handControllerConnected={handControllerConnected}
        lastGesture={lastGesture}
      />
      <main className="knowledge-grid">
        <div className="knowledge-left">
          <KnowledgeHeroCard knowledge={knowledge} config={config} />
          <KnowledgeInsightCard insight={knowledge.insight} />
        </div>
        <div className="knowledge-right">
          <KeyFactsCard facts={knowledge.facts} />
          <MiddleCard knowledge={knowledge} config={config} />
          <LowerCard knowledge={knowledge} config={config} />
        </div>
      </main>
      <KnowledgeBottomBar config={config} relatedTopics={knowledge.relatedTopics} />
    </div>
  );
}
