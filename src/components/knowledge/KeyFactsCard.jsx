import { Globe2, PawPrint } from "lucide-react";

function FactIcon({ icon, fallback }) {
  if (icon === "paw") return <PawPrint size={20} />;
  if (icon === "globe") return <Globe2 size={20} />;
  return fallback;
}

export function KeyFactsCard({ facts, moduleStyle = "compact-fact-rows" }) {
  const items = Array.isArray(facts) ? facts.filter((fact) => fact.label && fact.value).slice(0, 6) : [];
  return (
    <section className={`knowledge-card knowledge-card-pad knowledge-facts-card knowledge-module-${moduleStyle}`}>
      <h2 className="knowledge-card-title">Key Facts</h2>
      {items.length ? (
        <div className="knowledge-fact-list">
          {items.map((fact, index) => (
            <div className="knowledge-fact" key={`${fact.label}-${index}`}>
              <div className="knowledge-fact-mark">
                <FactIcon icon={fact.icon} fallback={String(index + 1).padStart(2, "0")} />
              </div>
              <div className="knowledge-fact-label">{fact.label}</div>
              <div className="knowledge-fact-value">{fact.value}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="knowledge-muted">Facts unavailable</div>
      )}
    </section>
  );
}
