import { WorldMap } from "./maps/WorldMap";
import { USMap } from "./maps/USMap";

export function KnowledgeMapCard({ maps, accent, moduleStyle = "world-map-pin" }) {
  const items = Array.isArray(maps) ? maps : [];
  const hasUs = items.some((map) => map.scope === "country" && /united states|usa|u\.s\.|us/i.test(`${map.label} ${map.highlight}`)) || items.some((map) => map.regionCode);
  return (
    <section className={`knowledge-card knowledge-card-pad knowledge-map-card knowledge-module-${moduleStyle}`}>
      <h2 className="knowledge-card-title">On the Map</h2>
      <div className="knowledge-map-wrap">
        {items.length ? (
          hasUs ? <USMap maps={items} accent={accent} /> : <WorldMap maps={items} accent={accent} />
        ) : (
          <div className="knowledge-muted">Location unavailable</div>
        )}
      </div>
    </section>
  );
}
