const STATE_POSITIONS = {
  FL: [455, 188],
  TX: [285, 176],
  CA: [105, 126],
  NY: [494, 76],
  WA: [118, 48],
};

export function USMap({ maps = [], accent = "#76B7FF" }) {
  const code = maps.find((map) => map.regionCode)?.regionCode;
  const point = STATE_POSITIONS[code] || [318, 120];
  return (
    <svg viewBox="0 0 600 270" role="img" aria-label="United States map" width="100%" height="100%">
      <path
        d="M82 73c72-28 142-30 205-18 54 10 84 11 130 2 31-6 67-4 91 17 16 14 3 33-20 42-29 11-47 30-58 61-10 29-45 28-64 13-31-25-80-11-111 5-36 18-85 17-103-13-12-20-9-43-33-57-22-13-69-17-62-38 3-7 11-11 25-14Z"
        fill="rgba(255,255,255,0.14)"
        stroke={accent}
        strokeOpacity="0.22"
        strokeWidth="1.4"
      />
      <circle cx={point[0]} cy={point[1]} r="26" fill={accent} opacity="0.18" />
      <circle cx={point[0]} cy={point[1]} r="14" fill="none" stroke={accent} strokeWidth="2" opacity="0.64" />
      <circle cx={point[0]} cy={point[1]} r="8" fill={accent} />
      <circle cx={point[0]} cy={point[1]} r="3" fill="#fff" />
    </svg>
  );
}
