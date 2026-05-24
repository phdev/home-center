const STATE_POSITIONS = {
  FL: [770, 506],
  TX: [433, 434],
  CA: [92, 318],
  NY: [806, 155],
  WA: [130, 70],
};

export function USMap({ maps = [], accent = "#76B7FF" }) {
  const points = maps
    .map((map) => ({ ...map, point: STATE_POSITIONS[map.regionCode] }))
    .filter((map) => map.point)
    .slice(0, 3);
  const fallbackPoint = STATE_POSITIONS[maps.find((map) => map.regionCode)?.regionCode] || [318, 120];
  return (
    <svg className="knowledge-us-map" viewBox="0 0 959 593" role="img" aria-label="United States map" width="100%" height="100%">
      <image
        className="knowledge-us-map-image"
        href="/home-center/knowledge-assets/us-map-states.svg"
        x="0"
        y="0"
        width="959"
        height="593"
        preserveAspectRatio="xMidYMid meet"
      />
      {(points.length ? points : [{ point: fallbackPoint, label: "", highlight: "" }]).map((map, index) => {
        const [x, y] = map.point;
        const labelX = index === 0 ? x - 132 : x + 22;
        const align = index === 0 ? "end" : "start";
        return (
          <g className="knowledge-us-poi" key={`${map.regionCode || index}-${map.label}`}>
            <circle cx={x} cy={y} r="34" fill={accent} opacity="0.13" />
            <circle cx={x} cy={y} r="8" fill={accent} />
            <circle cx={x} cy={y} r="3.2" fill="#fff" opacity="0.9" />
            {map.label && (
              <>
                <text x={labelX} y={y - 8} textAnchor={align} className="knowledge-us-poi-label">{map.label}</text>
                <text x={labelX} y={y + 14} textAnchor={align} className="knowledge-us-poi-detail">{map.detail || map.highlight}</text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
