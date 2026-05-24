import { ProcessDiagram } from "./diagrams/ProcessDiagram";
import { LifecycleDiagram } from "./diagrams/LifecycleDiagram";

export function ProcessDiagramCard({ type, glance, accent, moduleStyle = "process-flow" }) {
  const items = Array.isArray(glance?.metrics) ? glance.metrics : [];
  const isLifecycle = type === "fauna" || type === "flora";
  const title = type === "concept" ? "How It Works" : (isLifecycle ? "Lifecycle" : "Pattern");
  return (
    <section className={`knowledge-card knowledge-card-pad knowledge-diagram-card knowledge-module-${moduleStyle}`}>
      <h2 className="knowledge-card-title">{title}</h2>
      <div className="knowledge-diagram-wrap">
        {isLifecycle ? <LifecycleDiagram items={items} accent={accent} /> : <ProcessDiagram items={items} accent={accent} />}
      </div>
    </section>
  );
}
