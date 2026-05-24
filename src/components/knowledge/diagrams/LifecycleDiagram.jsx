const emperorPenguinSteps = [
  { label: "Adults", image: "/home-center/knowledge-assets/emperor-penguin-lifecycle-adults.png", x: 85, y: 28 },
  { label: "Egg", image: "/home-center/knowledge-assets/emperor-penguin-lifecycle-egg.png", x: 128, y: 90 },
  { label: "Chick", image: "/home-center/knowledge-assets/emperor-penguin-lifecycle-chick.png", x: 42, y: 90 },
];

function EmperorPenguinLifecycle({ accent }) {
  return (
    <svg viewBox="0 0 170 135" role="img" aria-label="Emperor penguin birth cycle" width="100%" height="100%">
      <defs>
        <marker id="knowledgeLifecycleArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 10 5 0 10z" fill={accent} />
        </marker>
        <filter id="knowledgeLifecycleGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor={accent} floodOpacity="0.32" />
          <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#000000" floodOpacity="0.34" />
        </filter>
      </defs>
      <path d="M68 36C50 43 39 58 39 75" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" opacity="0.82" markerEnd="url(#knowledgeLifecycleArrow)" />
      <path d="M57 106C76 121 101 121 116 106" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" opacity="0.82" markerEnd="url(#knowledgeLifecycleArrow)" />
      <path d="M129 74C126 56 109 39 93 36" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" opacity="0.82" markerEnd="url(#knowledgeLifecycleArrow)" />
      {emperorPenguinSteps.map((step) => (
        <g key={step.label} filter="url(#knowledgeLifecycleGlow)">
          <circle cx={step.x} cy={step.y} r="18" fill="rgba(2, 6, 23, 0.42)" stroke={accent} strokeOpacity="0.7" strokeWidth="1.4" />
          <image href={step.image} x={step.x - 17} y={step.y - 17} width="34" height="34" preserveAspectRatio="xMidYMid slice" />
        </g>
      ))}
    </svg>
  );
}

export function LifecycleDiagram({ items = [], accent = "#7BEA8C", variant }) {
  if (variant === "emperor-penguin") {
    return <EmperorPenguinLifecycle accent={accent} />;
  }
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
