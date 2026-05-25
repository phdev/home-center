import { WorldMap } from "./maps/WorldMap";
import { USMap } from "./maps/USMap";

function PlaceCallout({ item, side }) {
  if (!item?.label) return <div className="knowledge-place-callout knowledge-place-callout-empty" aria-hidden="true" />;
  return (
    <div className={`knowledge-place-callout knowledge-place-callout-${side}`}>
      <span className="knowledge-place-dot" aria-hidden="true" />
      <div>
        <div className="knowledge-place-label">{item.label}</div>
        {(item.detail || item.highlight) && <div className="knowledge-place-detail">{item.detail || item.highlight}</div>}
      </div>
    </div>
  );
}

export function KnowledgeMapCard({ maps, accent, moduleStyle = "world-map-pin" }) {
  const items = Array.isArray(maps) ? maps : [];
  const hasUs = items.some((map) => map.scope === "country" && /united states|usa|u\.s\.|us/i.test(`${map.label} ${map.highlight}`)) || items.some((map) => map.regionCode);
  const title = moduleStyle === "us-places-map" ? "Places" : "On the Map";
  const placeItems = items.filter((item) => item?.regionCode || item?.label).slice(0, 2);
  return (
    <section className={`knowledge-card knowledge-card-pad knowledge-map-card knowledge-module-${moduleStyle}`}>
      <h2 className="knowledge-card-title">{title}</h2>
      <div className="knowledge-map-wrap">
        {items.length ? (
          hasUs && moduleStyle === "us-places-map" ? (
            <div className="knowledge-places-map-layout">
              <PlaceCallout item={placeItems[0]} side="left" />
              <USMap maps={items} accent={accent} showLabels={false} />
              <PlaceCallout item={placeItems[1]} side="right" />
            </div>
          ) : hasUs ? <USMap maps={items} accent={accent} /> : <WorldMap maps={items} accent={accent} />
        ) : (
          <div className="knowledge-muted">Location unavailable</div>
        )}
      </div>
    </section>
  );
}
