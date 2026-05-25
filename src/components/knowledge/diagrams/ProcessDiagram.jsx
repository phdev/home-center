export function ProcessDiagram({ items = [], accent = "#b993ff" }) {
  const secondaryAccent = accent;
  const steps = items.length ? items.slice(0, 4) : [
    { label: "Input", value: "Start" },
    { label: "Process", value: "Change" },
    { label: "Output", value: "Result" },
  ];

  function StepIcon({ icon, x }) {
    if (icon === "devices") {
      return (
        <g transform={`translate(${x - 28} 82)`}>
          <rect x="0" y="0" width="34" height="23" rx="2" fill="none" stroke={accent} strokeWidth="3" />
          <path d="M-5 31h44" stroke={accent} strokeWidth="3" strokeLinecap="round" />
          <rect x="39" y="8" width="14" height="25" rx="2" fill="none" stroke={secondaryAccent} strokeWidth="3" />
        </g>
      );
    }
    if (icon === "router") {
      return (
        <g transform={`translate(${x - 28} 68)`}>
          <rect x="0" y="30" width="56" height="20" rx="4" fill="none" stroke={accent} strokeWidth="3" />
          <circle cx="12" cy="40" r="2.5" fill={accent} />
          <circle cx="23" cy="40" r="2.5" fill={accent} />
          <path d="M16 18c7-7 17-7 24 0M9 10c11-11 31-11 42 0" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    }
    if (icon === "packets") {
      return (
        <g transform={`translate(${x - 25} 75)`}>
          {[0, 1, 2, 3].map((row) => [0, 1, 2, 3].map((col) => (
            <rect key={`${row}-${col}`} x={col * 13} y={row * 13} width="8" height="8" rx="1.5" fill={col % 2 === row % 2 ? accent : secondaryAccent} opacity={col % 2 === row % 2 ? "0.9" : "0.68"} />
          )))}
        </g>
      );
    }
    if (icon === "servers") {
      return (
        <g transform={`translate(${x - 19} 65)`}>
          {[0, 1, 2].map((row) => (
            <g key={row} transform={`translate(0 ${row * 24})`}>
              <rect x="0" y="0" width="38" height="18" rx="3" fill="none" stroke={accent} strokeWidth="3" />
              <circle cx="28" cy="9" r="2.5" fill={accent} />
            </g>
          ))}
        </g>
      );
    }
    return (
      <>
        <circle cx={x} cy="98" r="34" fill={accent} opacity="0.2" />
        <circle cx={x} cy="98" r="18" fill={accent} />
      </>
    );
  }

  return (
    <svg viewBox="0 0 560 210" role="img" aria-label="Process diagram" width="100%" height="100%">
      {steps.map((step, index) => {
        const x = 36 + index * (488 / Math.max(steps.length - 1, 1));
        return (
          <g key={`${step.label}-${index}`}>
            {index < steps.length - 1 && (
              <line x1={x + 42} y1="98" x2={36 + (index + 1) * (488 / Math.max(steps.length - 1, 1)) - 42} y2="98" stroke={accent} strokeWidth="4" opacity="0.56" />
            )}
            <StepIcon icon={step.icon} x={x} />
            <text x={x} y="158" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="800">{step.label}</text>
            <text x={x} y="181" textAnchor="middle" fill="rgba(255,255,255,0.65)" fontSize="13">{step.value}</text>
          </g>
        );
      })}
    </svg>
  );
}
