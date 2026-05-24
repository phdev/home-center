const STATE_POSITIONS = {
  FL: [452, 194],
  TX: [287, 178],
  CA: [105, 126],
  NY: [494, 76],
  WA: [118, 48],
};

export function USMap({ maps = [], accent = "#76B7FF" }) {
  const points = maps
    .map((map) => ({ ...map, point: STATE_POSITIONS[map.regionCode] }))
    .filter((map) => map.point)
    .slice(0, 3);
  const fallbackPoint = STATE_POSITIONS[maps.find((map) => map.regionCode)?.regionCode] || [318, 120];
  return (
    <svg className="knowledge-us-map" viewBox="0 0 600 270" role="img" aria-label="United States map" width="100%" height="100%">
      <path
        className="knowledge-us-land"
        d="M66 68 99 55l48 5 42-19 53 7 44 15 56-2 39-16 55 8 44 18 38 2 22 27-17 26-45 8-26 24-4 30-33 9-48-9-44 8-51 26-48-8-53 2-39-22-14-33-34-14-39-4-31-25 13-28Z"
        fill="rgba(255,255,255,0.11)"
        stroke={accent}
        strokeOpacity="0.2"
        strokeWidth="1.4"
      />
      <path className="knowledge-us-grid" d="M105 61 94 146M155 49l-6 147M205 45l-4 161M255 52l-8 154M306 61l-12 145M357 59l-8 142M409 50l-11 138M461 61l-8 111M94 92h430M75 124h414M101 156h342M149 190h261" />
      <path
        className="knowledge-us-highlight"
        d="M227 154h87l16 17 4 30-25 15-41-8-43 3-22-24 10-22Z"
        fill={accent}
      />
      <path
        className="knowledge-us-highlight"
        d="M410 169h41l20 20 25 10-20 14-40-9-28-20Z"
        fill={accent}
      />
      {(points.length ? points : [{ point: fallbackPoint, label: "", highlight: "" }]).map((map, index) => {
        const [x, y] = map.point;
        const labelX = index === 0 ? x - 112 : x + 16;
        const align = index === 0 ? "end" : "start";
        return (
          <g className="knowledge-us-poi" key={`${map.regionCode || index}-${map.label}`}>
            <circle cx={x} cy={y} r="26" fill={accent} opacity="0.12" />
            <circle cx={x} cy={y} r="4.8" fill={accent} />
            <circle cx={x} cy={y} r="2" fill="#fff" opacity="0.9" />
            {map.label && (
              <>
                <text x={labelX} y={y - 4} textAnchor={align} className="knowledge-us-poi-label">{map.label}</text>
                <text x={labelX} y={y + 14} textAnchor={align} className="knowledge-us-poi-detail">{map.detail || map.highlight}</text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
