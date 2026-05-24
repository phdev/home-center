export function WorldMap({ maps = [], accent = "#b993ff" }) {
  const pin = maps.find((map) => Number.isFinite(map.lat) && Number.isFinite(map.lon));
  const highlightsAntarctica = maps.some((map) => /antarctica/i.test(`${map.label} ${map.highlight}`));
  const x = pin ? ((pin.lon + 180) / 360) * 600 : 305;
  const y = pin ? ((90 - pin.lat) / 180) * 270 : 126;

  return (
    <svg viewBox="0 0 600 270" role="img" aria-label="World map" width="100%" height="100%">
      <defs>
        <radialGradient id="worldMapGlow" cx="54%" cy="42%" r="62%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.22" />
          <stop offset="58%" stopColor={accent} stopOpacity="0.06" />
          <stop offset="100%" stopColor="#020617" stopOpacity="0.1" />
        </radialGradient>
        <mask id="antarcticaLandMask" maskUnits="userSpaceOnUse" x="35" y="205" width="530" height="36">
          <rect x="35" y="205" width="530" height="36" fill="black" />
          <image
            href="/home-center/knowledge-assets/world-map-equirectangular.svg"
            x="35"
            y="30"
            width="530"
            height="210"
            preserveAspectRatio="none"
          />
        </mask>
      </defs>
      <image
        href="/home-center/knowledge-assets/world-map-equirectangular.svg"
        x="35"
        y="30"
        width="530"
        height="210"
        preserveAspectRatio="none"
        opacity="0.9"
      />
      {highlightsAntarctica && (
        <g>
          <rect x="35" y="205" width="530" height="36" fill={accent} fillOpacity="0.72" mask="url(#antarcticaLandMask)" />
          <rect x="35" y="205" width="530" height="36" fill="none" stroke={accent} strokeOpacity="0.45" strokeWidth="1.2" mask="url(#antarcticaLandMask)" />
        </g>
      )}
      {!highlightsAntarctica && (
        <>
          <circle cx={x} cy={y} r="24" fill={accent} opacity="0.18" />
          <circle cx={x} cy={y} r="14" fill="none" stroke={accent} strokeWidth="2" opacity="0.7" />
          <circle cx={x} cy={y} r="8" fill={accent} />
          <circle cx={x} cy={y} r="3" fill="#fff" />
        </>
      )}
    </svg>
  );
}
