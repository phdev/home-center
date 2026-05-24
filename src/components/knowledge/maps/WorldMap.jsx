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
      <rect width="600" height="270" rx="8" fill="rgba(255,255,255,0.025)" />
      <rect x="1" y="1" width="598" height="268" rx="8" fill="url(#worldMapGlow)" />
      <g stroke="rgba(255,255,255,0.07)" strokeWidth="1">
        {[80, 160, 240, 320, 400, 480, 560].map((line) => <line key={`v${line}`} x1={line} y1="18" x2={line} y2="232" />)}
        {[54, 108, 162, 216].map((line) => <line key={`h${line}`} x1="24" y1={line} x2="576" y2={line} />)}
      </g>
      <image
        href="/home-center/knowledge-assets/world-map-equirectangular.svg"
        x="35"
        y="30"
        width="530"
        height="210"
        preserveAspectRatio="none"
        opacity="0.72"
      />
      {highlightsAntarctica && (
        <g>
          <rect x="35" y="205" width="530" height="36" fill={accent} fillOpacity="0.72" mask="url(#antarcticaLandMask)" />
          <rect x="35" y="205" width="530" height="36" fill="none" stroke={accent} strokeOpacity="0.45" strokeWidth="1.2" mask="url(#antarcticaLandMask)" />
          <text x="368" y="247" textAnchor="middle" fill={accent} fontSize="16" fontWeight="900">
            ANTARCTICA
          </text>
        </g>
      )}
      <path d="M30 225C111 190 173 211 250 198c77-14 140-59 227-38 43 10 71 31 91 52" fill="none" stroke={accent} strokeOpacity="0.22" strokeWidth="2" />
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
