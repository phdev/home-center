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
      <rect width="600" height="270" rx="8" fill="rgba(255,255,255,0.035)" />
      <rect x="1" y="1" width="598" height="268" rx="8" fill="url(#worldMapGlow)" />
      <g stroke="rgba(255,255,255,0.1)" strokeWidth="1">
        {[80, 160, 240, 320, 400, 480, 560].map((line) => <line key={`v${line}`} x1={line} y1="20" x2={line} y2="250" />)}
        {[54, 108, 162, 216].map((line) => <line key={`h${line}`} x1="28" y1={line} x2="572" y2={line} />)}
      </g>
      <g fill="rgba(255,255,255,0.24)" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5">
        <path d="M65 92c36-29 85-35 126-21 26 9 38 31 25 52-16 27-69 19-91 48-19 25-67 8-72-26-4-24-6-39 12-53Z" />
        <path d="M244 66c32-19 82-17 111 2 21 14 31 38 13 57-24 26-19 51 9 69 19 13 8 34-23 31-52-6-67-38-89-70-16-24-56-22-51-56 2-15 13-24 30-33Z" />
        <path d="M398 76c42-18 93-13 128 12 28 20 20 55-19 62-24 5-41 17-52 39-12 26-49 24-59-4-9-24 21-44 8-68-8-14-23-31-6-41Z" />
        <path d="M447 180c20 8 44 6 61 21 15 14 6 31-17 32-27 1-63-24-55-43 2-5 6-8 11-10Z" />
      </g>
      {highlightsAntarctica && (
        <g>
          <path
            d="M205 226c44-15 73-10 104-11 44-2 88-13 130-5 31 6 58 6 82 2-11 17-41 24-85 25-49 2-89-6-132-3-48 3-82 0-99-8Z"
            fill={accent}
            fillOpacity="0.62"
            stroke={accent}
            strokeOpacity="0.75"
            strokeWidth="1.5"
          />
          <text x="365" y="253" textAnchor="middle" fill={accent} fontSize="17" fontWeight="900">
            ANTARCTICA
          </text>
        </g>
      )}
      <path d="M36 228C118 196 178 218 256 202c75-15 134-61 220-42 43 10 70 30 88 50" fill="none" stroke={accent} strokeOpacity="0.22" strokeWidth="2" />
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
