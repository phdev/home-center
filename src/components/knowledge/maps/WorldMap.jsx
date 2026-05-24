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
      </defs>
      <rect width="600" height="270" rx="8" fill="rgba(255,255,255,0.025)" />
      <rect x="1" y="1" width="598" height="268" rx="8" fill="url(#worldMapGlow)" />
      <g stroke="rgba(255,255,255,0.07)" strokeWidth="1">
        {[80, 160, 240, 320, 400, 480, 560].map((line) => <line key={`v${line}`} x1={line} y1="18" x2={line} y2="232" />)}
        {[54, 108, 162, 216].map((line) => <line key={`h${line}`} x1="24" y1={line} x2="576" y2={line} />)}
      </g>
      <g fill="rgba(135,162,189,0.38)" stroke="rgba(170,210,230,0.08)" strokeWidth="1.5">
        <path d="M92 82c24-20 64-25 95-13 23 9 38 26 36 45-2 17-20 22-35 27-18 6-30 19-43 32-14 14-39 12-56 0-19-13-28-35-25-57 2-15 13-25 28-34Z" />
        <path d="M197 138c23 8 39 31 38 56-1 25-17 54-36 63-15 7-23-12-19-29 4-18-4-31-11-46-8-19 5-39 28-44Z" />
        <path d="M279 71c28-12 62-8 84 7 15 10 24 25 18 38-7 17-31 14-43 28-13 15-4 38-20 48-17 11-36-7-42-27-7-23-34-26-41-47-6-18 14-34 44-47Z" />
        <path d="M327 117c32 4 57 31 63 65 5 25-7 54-28 63-18 8-38-8-35-29 3-22-14-38-21-58-6-19 2-35 21-41Z" />
        <path d="M372 80c40-21 101-22 145-3 34 14 56 43 43 67-10 17-39 17-61 15-28-3-42 11-57 28-14 16-39 13-52-6-12-17 15-36 11-58-3-17-28-24-29-43Z" />
        <path d="M476 176c28-8 67 2 80 23 11 18-2 35-29 38-28 4-59-11-68-29-7-14 0-27 17-32Z" />
        <path d="M124 58c13-7 34-6 45 1 9 6 8 17-4 21-16 6-45-1-48-10-2-5 1-9 7-12Z" />
      </g>
      {highlightsAntarctica && (
        <g>
          <path
            d="M218 220c31-10 60-8 89-9 48-2 91-12 137-5 24 4 49 5 75 1-10 13-34 21-69 23-45 4-84-4-126-1-47 3-85 0-106-9Z"
            fill={accent}
            fillOpacity="0.72"
            stroke={accent}
            strokeOpacity="0.86"
            strokeWidth="1.5"
          />
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
