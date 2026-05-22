export function LifecycleDiagram({ items = [], accent = "#7BEA8C" }) {
  const steps = items.length ? items.slice(0, 4) : [
    { label: "Birth", value: "Start" },
    { label: "Growth", value: "Develop" },
    { label: "Adult", value: "Mature" },
    { label: "Renew", value: "Cycle" },
  ];
  return (
    <svg viewBox="0 0 560 210" role="img" aria-label="Lifecycle diagram" width="100%" height="100%">
      <circle cx="280" cy="104" r="70" fill="none" stroke={accent} strokeWidth="5" opacity="0.38" strokeDasharray="9 10" />
      {steps.map((step, index) => {
        const angle = (-90 + index * (360 / steps.length)) * Math.PI / 180;
        const x = 280 + Math.cos(angle) * 86;
        const y = 104 + Math.sin(angle) * 70;
        return (
          <g key={`${step.label}-${index}`}>
            <circle cx={x} cy={y} r="28" fill={accent} opacity="0.24" />
            <circle cx={x} cy={y} r="14" fill={accent} />
            <text x={x} y={y + 50} textAnchor="middle" fill="#fff" fontSize="15" fontWeight="800">{step.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
