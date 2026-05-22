export function WorldMap({ maps = [], accent = "#b993ff" }) {
  const pin = maps.find((map) => Number.isFinite(map.lat) && Number.isFinite(map.lon));
  const x = pin ? ((pin.lon + 180) / 360) * 600 : 305;
  const y = pin ? ((90 - pin.lat) / 180) * 270 : 126;

  return (
    <svg viewBox="0 0 600 270" role="img" aria-label="World map" width="100%" height="100%">
      <rect width="600" height="270" rx="8" fill="rgba(255,255,255,0.035)" />
      <g fill="rgba(255,255,255,0.18)">
        <path d="M65 92c36-29 85-35 126-21 26 9 38 31 25 52-16 27-69 19-91 48-19 25-67 8-72-26-4-24-6-39 12-53Z" />
        <path d="M244 66c32-19 82-17 111 2 21 14 31 38 13 57-24 26-19 51 9 69 19 13 8 34-23 31-52-6-67-38-89-70-16-24-56-22-51-56 2-15 13-24 30-33Z" />
        <path d="M398 76c42-18 93-13 128 12 28 20 20 55-19 62-24 5-41 17-52 39-12 26-49 24-59-4-9-24 21-44 8-68-8-14-23-31-6-41Z" />
        <path d="M447 180c20 8 44 6 61 21 15 14 6 31-17 32-27 1-63-24-55-43 2-5 6-8 11-10Z" />
      </g>
      <g stroke="rgba(255,255,255,0.12)" strokeWidth="1">
        {[100, 200, 300, 400, 500].map((line) => <line key={`v${line}`} x1={line} y1="22" x2={line} y2="248" />)}
        {[70, 135, 200].map((line) => <line key={`h${line}`} x1="30" y1={line} x2="570" y2={line} />)}
      </g>
      <circle cx={x} cy={y} r="24" fill={accent} opacity="0.18" />
      <circle cx={x} cy={y} r="8" fill={accent} />
      <circle cx={x} cy={y} r="3" fill="#fff" />
    </svg>
  );
}
