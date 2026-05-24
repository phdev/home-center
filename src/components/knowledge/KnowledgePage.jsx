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
  const moduleStyle = knowledge.visualPlan.moduleStyles?.middle;
  if (knowledge.type === "person") {
    return <TimelineCard timeline={knowledge.timeline} moduleStyle={moduleStyle} fallback={<AtAGlanceCard glance={knowledge.glance} type={knowledge.type} accent={config.accent} moduleStyle={knowledge.visualPlan.moduleStyles?.lower} />} />;
  }
  if (knowledge.type === "event") {
    return <PlacesCard maps={knowledge.maps} accent={config.accent} moduleStyle={moduleStyle} />;
  }
  if (knowledge.type === "concept") {
    return <ProcessDiagramCard type={knowledge.type} glance={knowledge.glance} accent={config.accent} moduleStyle={moduleStyle} />;
  }
  return <KnowledgeMapCard maps={knowledge.maps} accent={config.accent} moduleStyle={moduleStyle} />;
}

function LowerCard({ knowledge, config }) {
  const moduleStyle = knowledge.visualPlan.moduleStyles?.lower;
  if (knowledge.type === "event") {
    return <TimelineCard timeline={knowledge.timeline} moduleStyle={moduleStyle} fallback={<AtAGlanceCard glance={knowledge.glance} moduleStyle={moduleStyle} />} />;
  }
  if (knowledge.type === "concept") {
    return <AtAGlanceCard glance={knowledge.glance} moduleStyle={moduleStyle} />;
  }
  if (knowledge.type === "fauna" || knowledge.type === "flora") {
    return knowledge.glance.metrics.length
        ? <AtAGlanceCard glance={knowledge.glance} type={knowledge.type} accent={config.accent} moduleStyle={moduleStyle} />
        : <ProcessDiagramCard type={knowledge.type} glance={knowledge.glance} accent={config.accent} moduleStyle={moduleStyle} />;
  }
  return <AtAGlanceCard glance={knowledge.glance} type={knowledge.type} accent={config.accent} moduleStyle={moduleStyle} />;
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
      <div className="knowledge-stage">
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
            <KeyFactsCard facts={knowledge.facts} moduleStyle={knowledge.visualPlan.moduleStyles?.facts} />
            <MiddleCard knowledge={knowledge} config={config} />
            <LowerCard knowledge={knowledge} config={config} />
          </div>
        </main>
        <KnowledgeBottomBar config={config} relatedTopics={knowledge.relatedTopics} />
      </div>
    </div>
  );
}
