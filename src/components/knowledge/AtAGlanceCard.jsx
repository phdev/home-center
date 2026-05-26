import { Building2, Calculator, Code2, Cog, Dna, Globe2, Leaf, Map, MessagesSquare, PawPrint, Ruler, ShieldCheck, Weight } from "lucide-react";
import { LifecycleDiagram } from "./diagrams/LifecycleDiagram";

function MetricIcon({ icon, fallback }) {
  if (icon === "ruler") return <Ruler size={24} />;
  if (icon === "weight") return <Weight size={24} />;
  if (icon === "dna") return <Dna size={24} />;
  if (icon === "paw") return <PawPrint size={24} />;
  if (icon === "flora" || icon === "leaf") return <Leaf size={24} />;
  if (icon === "calculator") return <Calculator size={24} />;
  if (icon === "cog") return <Cog size={24} />;
  if (icon === "code") return <Code2 size={24} />;
  if (icon === "globe") return <Globe2 size={24} />;
  if (icon === "map") return <Map size={24} />;
  if (icon === "city") return <Building2 size={24} />;
  if (icon === "shield") return <ShieldCheck size={24} />;
  if (icon === "services") return <MessagesSquare size={24} />;
  return fallback;
}

export function AtAGlanceCard({ glance, moduleStyle = "icon-metric-columns", type, accent, subjectTitle = "" }) {
  const metrics = Array.isArray(glance?.metrics) ? glance.metrics.slice(0, 3) : [];
  const showLifecycle = /emperor penguin/i.test(subjectTitle) && metrics.length > 0;
  const visualUrl = glance?.visual?.url || "";
  const showIslandVisual = moduleStyle === "island-shape-stats" && visualUrl && metrics.length > 0;
  return (
    <section className={`knowledge-card knowledge-card-pad knowledge-glance-card knowledge-module-${moduleStyle}`}>
      <h2 className="knowledge-card-title">{glance?.title || "At a Glance"}</h2>
      {showIslandVisual ? null : (glance?.description && <p className="knowledge-timeline-desc">{glance.description}</p>)}
      {metrics.length ? (
        showIslandVisual ? (
          <div className="knowledge-island-glance">
            <img className="knowledge-island-glance-visual" src={visualUrl} alt={glance?.visual?.alt || ""} />
            <div className="knowledge-island-glance-body">
              {glance?.description && <p className="knowledge-island-glance-copy">{glance.description}</p>}
              <div className="knowledge-metrics">
                {metrics.map((metric, index) => (
                  <div className="knowledge-metric" key={`${metric.label}-${index}`}>
                    <div className="knowledge-metric-icon">
                      <MetricIcon icon={metric.icon} fallback={String(index + 1).padStart(2, "0")} />
                    </div>
                    <div className="knowledge-metric-value">{metric.value}</div>
                    <div className="knowledge-metric-label">{metric.label}</div>
                    {metric.sublabel && <div className="knowledge-metric-sublabel">{metric.sublabel}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : showLifecycle ? (
          <div className="knowledge-glance-content">
            <div className="knowledge-glance-life" aria-hidden="true">
              <LifecycleDiagram variant="emperor-penguin" accent={accent} />
            </div>
            <div className="knowledge-metrics">
              {metrics.map((metric, index) => (
                <div className="knowledge-metric" key={`${metric.label}-${index}`}>
                  <div className="knowledge-metric-icon">
                    <MetricIcon icon={metric.icon} fallback={String(index + 1).padStart(2, "0")} />
                  </div>
                  <div className="knowledge-metric-label">{metric.label}</div>
                  <div className="knowledge-metric-value">{metric.value}</div>
                  {metric.sublabel && <div className="knowledge-metric-sublabel">{metric.sublabel}</div>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="knowledge-metrics">
            {metrics.map((metric, index) => (
              <div className="knowledge-metric" key={`${metric.label}-${index}`}>
                <div className="knowledge-metric-icon">
                  <MetricIcon icon={metric.icon} fallback={String(index + 1).padStart(2, "0")} />
                </div>
                <div className="knowledge-metric-label">{metric.label}</div>
                <div className="knowledge-metric-value">{metric.value}</div>
                {metric.sublabel && <div className="knowledge-metric-sublabel">{metric.sublabel}</div>}
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="knowledge-muted">Related concepts unavailable</div>
      )}
    </section>
  );
}
