export function ProcessDiagram({ items = [], accent = "#b993ff" }) {
  const steps = items.length ? items.slice(0, 4) : [
    { label: "Input", value: "Start" },
    { label: "Process", value: "Change" },
    { label: "Output", value: "Result" },
  ];
  return (
    <svg viewBox="0 0 560 210" role="img" aria-label="Process diagram" width="100%" height="100%">
      {steps.map((step, index) => {
        const x = 36 + index * (488 / Math.max(steps.length - 1, 1));
        return (
          <g key={`${step.label}-${index}`}>
            {index < steps.length - 1 && (
              <line x1={x + 42} y1="98" x2={36 + (index + 1) * (488 / Math.max(steps.length - 1, 1)) - 42} y2="98" stroke={accent} strokeWidth="4" opacity="0.56" />
            )}
            <circle cx={x} cy="98" r="34" fill={accent} opacity="0.2" />
            <circle cx={x} cy="98" r="18" fill={accent} />
            <text x={x} y="158" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="800">{step.label}</text>
            <text x={x} y="181" textAnchor="middle" fill="rgba(255,255,255,0.65)" fontSize="13">{step.value}</text>
          </g>
        );
      })}
    </svg>
  );
}
