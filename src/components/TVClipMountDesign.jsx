import { useState, useMemo } from "react";

const C = {
  bg: "#0a0a0a", panel: "#111", border: "#222",
  shell: "#1a1a1a", shellHi: "#2a2a2a", shellStroke: "#333",
  board: "#1a472a", boardStroke: "#3a7a4a",
  accent: "#3B82F6", dim: "#888", dimLine: "#444",
  text: "#ccc", muted: "#666", led: "#4ade80",
  mic: "#ef4444", screw: "#999", usb: "#888",
};

// Generate icosphere: subdivision 1 of icosahedron = 80 faces, 42 vertices
function makeIco() {
  const t = (1 + Math.sqrt(5)) / 2;
  const raw = [
    [-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],
    [0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],
    [t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1],
  ];
  const V = raw.map(v => {
    const l = Math.hypot(...v);
    return v.map(c => c / l);
  });
  const F = [
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
    [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
    [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1],
  ];
  // Subdivide once
  const mc = {};
  const nf = [];
  function mid(i, j) {
    const k = Math.min(i,j)+"_"+Math.max(i,j);
    if (mc[k] !== undefined) return mc[k];
    const m = [0,1,2].map(d => (V[i][d]+V[j][d])/2);
    const l = Math.hypot(...m);
    V.push(m.map(c => c/l));
    mc[k] = V.length - 1;
    return mc[k];
  }
  for (const [a,b,c] of F) {
    const ab=mid(a,b), bc=mid(b,c), ca=mid(c,a);
    nf.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);
  }
  return { V, F: nf };
}

const ICO = makeIco();
const BASE_CUT_Y = -0.65;

// Classify special faces
function classify() {
  const { V, F } = ICO;
  const micPorts = [];
  const baseCut = [];
  const ledTop = [];
  const cands = [];

  F.forEach((f, i) => {
    const cy = (V[f[0]][1]+V[f[1]][1]+V[f[2]][1])/3;
    const cx = (V[f[0]][0]+V[f[1]][0]+V[f[2]][0])/3;
    const cz = (V[f[0]][2]+V[f[1]][2]+V[f[2]][2])/3;
    if (cy < BASE_CUT_Y) baseCut.push(i);
    if (cy > 0.75) ledTop.push(i);
    if (cy > 0.25 && cy < 0.6) {
      cands.push({ i, az: Math.atan2(cz, cx) });
    }
  });

  for (const target of [0, Math.PI/2, Math.PI, -Math.PI/2]) {
    let best = null, bd = Infinity;
    for (const c of cands) {
      let d = Math.abs(c.az - target);
      if (d > Math.PI) d = 2*Math.PI - d;
      if (d < bd && !micPorts.includes(c.i)) { bd = d; best = c.i; }
    }
    if (best !== null) micPorts.push(best);
  }
  return { baseCut: new Set(baseCut), micPorts: new Set(micPorts), ledTop: new Set(ledTop) };
}

const CLS = classify();

// 3D rotation
function rot(v, rx, ry) {
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const x1 = v[0]*cy + v[2]*sy;
  const z1 = -v[0]*sy + v[2]*cy;
  const y1 = v[1]*cx - z1*sx;
  const z2 = v[1]*sx + z1*cx;
  return [x1, -y1, z2];
}

// Render icosphere to SVG polygons
function renderIco(opts = {}) {
  const {
    rx = -0.3, ry = 0.5, s = 120, ox = 0, oy = 0,
    light = [0.3, 0.7, -0.6],
    showMic = true, showLed = true, showBase = true,
    showSplit = false, cutaway = false, opacity = 1,
    micColor = C.mic, baseAlpha = 0.15,
    filterUpper = false, filterLower = false,
  } = opts;
  const { V, F } = ICO;
  const ll = Math.hypot(...light);
  const ln = light.map(c => c/ll);

  const proj = V.map(v => {
    const r = rot(v, rx, ry);
    return { x: r[0]*s + ox, y: r[1]*s + oy, z: r[2] };
  });

  const faces = F.map((f, idx) => {
    const [a,b,c] = f;
    const pa = proj[a], pb = proj[b], pc = proj[c];
    const avgZ = (pa.z+pb.z+pc.z)/3;
    // Face centroid in original coords (on unit sphere, centroid ≈ normal)
    const cn = [0,1,2].map(d => (V[a][d]+V[b][d]+V[c][d])/3);
    const cl = Math.hypot(...cn);
    const n = cn.map(c => c/cl);
    const rn = rot(n, rx, ry);
    // Back-face: rn[2] > 0 means facing away (remember y is flipped)
    if (rn[2] > 0.05) return null;

    const isCut = CLS.baseCut.has(idx);
    const isMic = CLS.micPorts.has(idx);
    const isLed = CLS.ledTop.has(idx);
    const isUpper = cn[1] >= 0;
    const isLower = cn[1] < 0;

    if (showBase && isCut) return null;
    if (filterUpper && isUpper) return null;
    if (filterLower && isLower && !isCut) return null;
    if (cutaway && rn[0] > 0.05) return null;

    const dot = Math.max(0, -(rn[0]*ln[0] + rn[1]*ln[1] + rn[2]*ln[2]));
    const ambient = 0.15;
    const bright = Math.min(1, ambient + dot * 0.85);

    let fill;
    if (showMic && isMic) {
      fill = micColor;
    } else if (showLed && isLed) {
      const g = Math.round(60 + bright * 100);
      fill = `rgb(${Math.round(bright*40)},${g},${Math.round(bright*40)})`;
    } else {
      const v = Math.round(18 + bright * 38);
      fill = `rgb(${v},${v},${v})`;
    }

    return {
      pts: `${pa.x},${pa.y} ${pb.x},${pb.y} ${pc.x},${pc.y}`,
      z: avgZ, fill, isMic, isLed, isCut, isUpper,
      stroke: showSplit && Math.abs(cn[1]) < 0.08 ? C.accent : C.shellStroke,
      strokeW: showSplit && Math.abs(cn[1]) < 0.08 ? 1.2 : 0.3,
      alpha: isCut ? baseAlpha : opacity,
    };
  }).filter(Boolean);

  faces.sort((a, b) => b.z - a.z);
  return faces;
}

// === VIEW COMPONENTS ===

function Icosphere({ faces }) {
  return faces.map((f, i) => (
    <polygon key={i} points={f.pts} fill={f.fill}
      stroke={f.stroke} strokeWidth={f.strokeW}
      opacity={f.alpha} strokeLinejoin="round" />
  ));
}

// Product rendering — geosphere on a desk
function RenderView() {
  const faces = useMemo(() => renderIco({
    rx: -0.25, ry: 0.6, s: 160, ox: 480, oy: 260,
    showMic: true, showLed: true, showBase: true, showSplit: false,
  }), []);

  return (
    <svg width="100%" height="100%" viewBox="0 0 960 540" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="wallG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16161a" /><stop offset="100%" stopColor="#0e0e11" />
        </linearGradient>
        <linearGradient id="deskG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2520" /><stop offset="100%" stopColor="#1a1612" />
        </linearGradient>
        <radialGradient id="ledGlow" cx="0.5" cy="0.35" r="0.35">
          <stop offset="0%" stopColor="#4ade80" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
        </radialGradient>
        <filter id="shadow"><feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000" floodOpacity="0.6"/></filter>
        <filter id="glow"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>

      {/* Wall */}
      <rect width="960" height="540" fill="url(#wallG)" />

      {/* Desk surface */}
      <rect x="0" y="370" width="960" height="170" fill="url(#deskG)" />
      <line x1="0" y1="370" x2="960" y2="370" stroke="#3a3530" strokeWidth="0.5" />

      {/* Shadow on desk */}
      <ellipse cx="480" cy="392" rx="100" ry="14" fill="#000" opacity="0.4" />

      {/* LED glow halo */}
      <circle cx="480" cy="260" r="180" fill="url(#ledGlow)" />

      {/* Geosphere */}
      <g filter="url(#shadow)">
        <Icosphere faces={faces} />
      </g>

      {/* Flat base contact line */}
      <ellipse cx="480" cy="388" rx="52" ry="6" fill="none" stroke="#333" strokeWidth="0.5" />

      {/* USB-C cable */}
      <path d="M 560,350 Q 580,380 580,400 Q 580,430 620,450" stroke="#333" strokeWidth="2" fill="none" strokeDasharray="4,3" />
      <text x="628" y="455" fontSize="9" fill={C.muted} fontFamily="monospace">USB-C to Pi 5</text>

      {/* Callout */}
      <line x1="380" y1="180" x2="200" y2="80" stroke={C.dimLine} strokeWidth="0.5" strokeDasharray="3,2" />
      <g>
        <rect x="40" y="50" width="210" height="65" rx="5" fill="#111" stroke={C.border} strokeWidth="0.5" />
        <text x="52" y="72" fontSize="12" fill={C.accent} fontWeight="600" fontFamily="system-ui, sans-serif">Comni Voice Puck</text>
        <text x="52" y="87" fontSize="9" fill={C.muted} fontFamily="monospace">85mm geosphere, 80 facets</text>
        <text x="52" y="101" fontSize="9" fill={C.muted} fontFamily="monospace">4 mic ports + 12 LED ring</text>
      </g>

      {/* Mic port callout */}
      <line x1="405" y1="235" x2="720" y2="140" stroke={C.mic} strokeWidth="0.4" strokeDasharray="2,2" />
      <g>
        <rect x="724" y="122" width="180" height="38" rx="4" fill="#111" stroke={C.border} strokeWidth="0.5" />
        <text x="734" y="140" fontSize="9" fill={C.mic} fontFamily="monospace">Mic port (open face)</text>
        <text x="734" y="153" fontSize="8" fill={C.muted} fontFamily="monospace">4x evenly spaced</text>
      </g>

      {/* Title */}
      <text x="480" y="30" textAnchor="middle" fontSize="14" fill={C.accent} fontWeight="600" fontFamily="system-ui, sans-serif">
        COMNI VOICE PUCK — PRODUCT VIEW
      </text>

      {/* Scale ref */}
      <text x="30" y="520" fontSize="8" fill={C.dimLine} fontFamily="monospace">
        85mm diameter — approximately baseball-sized
      </text>
    </svg>
  );
}

// Front view with annotations
function FrontAnnotated() {
  const faces = useMemo(() => renderIco({
    rx: -0.2, ry: 0.4, s: 150, ox: 400, oy: 270,
    showMic: true, showLed: true, showBase: true, showSplit: true,
  }), []);

  return (
    <svg width="100%" height="100%" viewBox="0 0 960 540" preserveAspectRatio="xMidYMid meet">
      <Icosphere faces={faces} />

      {/* Equator split line label */}
      <line x1="245" y1="275" x2="180" y2="275" stroke={C.accent} strokeWidth="0.5" strokeDasharray="3,2" />
      <text x="60" y="272" fontSize="9" fill={C.accent} fontFamily="monospace">Equator split</text>
      <text x="60" y="284" fontSize="8" fill={C.muted} fontFamily="monospace">Press-fit join</text>

      {/* Mic port label */}
      <line x1="330" y1="175" x2="180" y2="120" stroke={C.mic} strokeWidth="0.5" strokeDasharray="2,2" />
      <text x="60" y="117" fontSize="9" fill={C.mic} fontFamily="monospace">Mic port opening</text>
      <text x="60" y="130" fontSize="8" fill={C.muted} fontFamily="monospace">Open triangle face</text>

      {/* LED glow area */}
      <line x1="410" y1="130" x2="700" y2="70" stroke={C.led} strokeWidth="0.5" strokeDasharray="2,2" />
      <text x="710" y="67" fontSize="9" fill={C.led} fontFamily="monospace">LED glow zone</text>
      <text x="710" y="80" fontSize="8" fill={C.muted} fontFamily="monospace">Translucent top faces</text>
      <text x="710" y="93" fontSize="8" fill={C.muted} fontFamily="monospace">12x APA102 RGB visible</text>

      {/* Flat base */}
      <line x1="425" y1="410" x2="700" y2="460" stroke={C.muted} strokeWidth="0.5" strokeDasharray="2,2" />
      <text x="710" y="457" fontSize="9" fill={C.muted} fontFamily="monospace">Flat base (~48mm dia)</text>
      <text x="710" y="470" fontSize="8" fill={C.muted} fontFamily="monospace">Truncated 15mm from pole</text>

      {/* USB-C port area */}
      <line x1="545" y1="340" x2="700" y2="360" stroke={C.usb} strokeWidth="0.5" strokeDasharray="2,2" />
      <text x="710" y="357" fontSize="9" fill={C.usb} fontFamily="monospace">USB-C port cutout</text>
      <text x="710" y="370" fontSize="8" fill={C.muted} fontFamily="monospace">Lower hemisphere</text>

      {/* Dimension: diameter */}
      <line x1="250" y1="50" x2="550" y2="50" stroke={C.dimLine} strokeWidth="0.5" />
      <line x1="250" y1="45" x2="250" y2="55" stroke={C.dimLine} strokeWidth="0.5" />
      <line x1="550" y1="45" x2="550" y2="55" stroke={C.dimLine} strokeWidth="0.5" />
      <text x="400" y="45" textAnchor="middle" fontSize="9" fill={C.dim} fontFamily="monospace">85mm</text>

      <text x="400" y="510" textAnchor="middle" fontSize="10" fill={C.accent} fontWeight="600" fontFamily="system-ui, sans-serif">
        FRONT VIEW — ANNOTATED
      </text>
    </svg>
  );
}

// Cross-section view — schematic side cut
function SectionView() {
  const R = 130; // sphere radius in SVG units
  const cx = 400, cy = 260;
  const baseCutY = cy + R * 0.65; // flat base
  const baseR = Math.sqrt(R*R - (R*0.65)*(R*0.65));
  const pcbY = baseCutY - 28; // PCB position
  const pcbW = R * 1.55; // 70mm PCB in 85mm sphere

  // Generate icosphere outline triangles visible in cross-section
  // We'll draw the sphere outline plus hatched walls
  return (
    <svg width="100%" height="100%" viewBox="0 0 960 540" preserveAspectRatio="xMidYMid meet">
      {/* Outer sphere outline */}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={C.shellStroke} strokeWidth="1.5" />
      {/* Inner sphere (wall thickness) */}
      <circle cx={cx} cy={cy} r={R-8} fill="none" stroke={C.shellStroke} strokeWidth="0.5" strokeDasharray="4,3" />

      {/* Wall cross-hatch (right half only for section view) */}
      {Array.from({length: 20}).map((_, i) => {
        const angle = -Math.PI/2 + (Math.PI) * (i / 19);
        const y = cy + Math.sin(angle) * R;
        if (y > baseCutY) return null;
        const xOuter = cx + Math.cos(angle) * R;
        const xInner = cx + Math.cos(angle) * (R - 8);
        return (
          <g key={i}>
            <line x1={xOuter} y1={y} x2={xInner} y2={y} stroke={C.shellStroke} strokeWidth="0.3" />
          </g>
        );
      })}

      {/* Flat base */}
      <line x1={cx - baseR} y1={baseCutY} x2={cx + baseR} y2={baseCutY} stroke={C.text} strokeWidth="1.5" />

      {/* Equator split line */}
      <line x1={cx - R - 20} y1={cy} x2={cx + R + 20} y2={cy} stroke={C.accent} strokeWidth="0.8" strokeDasharray="6,3" />
      <text x={cx + R + 25} y={cy + 4} fontSize="9" fill={C.accent} fontFamily="monospace">Equator split</text>

      {/* Press-fit lip detail */}
      <rect x={cx + R - 12} y={cy - 3} width="8" height="6" fill="none" stroke={C.accent} strokeWidth="0.5" />
      <text x={cx + R + 2} y={cy + 18} fontSize="7" fill={C.muted} fontFamily="monospace">1mm press-fit lip</text>

      {/* PCB */}
      <rect x={cx - pcbW/2} y={pcbY} width={pcbW} height={5} fill={C.board} stroke={C.boardStroke} strokeWidth="0.8" rx="1" />
      <text x={cx} y={pcbY - 5} textAnchor="middle" fontSize="8" fill={C.boardStroke} fontFamily="monospace">XVF3800 PCB (70mm)</text>

      {/* LEDs on top of PCB */}
      {[-40, -25, -10, 5, 20, 35].map((dx, i) => (
        <rect key={i} x={cx + dx - 3} y={pcbY - 3} width="6" height="3" fill={C.led} opacity="0.6" rx="0.5" />
      ))}
      <text x={cx + pcbW/2 + 10} y={pcbY} fontSize="7" fill={C.led} fontFamily="monospace">12x LEDs (top)</text>

      {/* MEMS mics on bottom of PCB */}
      {[-35, -12, 12, 35].map((dx, i) => (
        <rect key={i} x={cx + dx - 2} y={pcbY + 5} width="4" height="3" fill={C.mic} opacity="0.7" rx="0.5" />
      ))}
      <text x={cx + pcbW/2 + 10} y={pcbY + 12} fontSize="7" fill={C.mic} fontFamily="monospace">4x MEMS mics (bottom)</text>

      {/* M2 standoffs */}
      {[-45, 0, 45].map((dx, i) => (
        <rect key={i} x={cx + dx - 3} y={pcbY + 5} width="6" height={baseCutY - pcbY - 5} fill={C.screw} opacity="0.5" rx="0.5" />
      ))}
      <text x={cx - pcbW/2 - 80} y={baseCutY - 10} fontSize="7" fill={C.screw} fontFamily="monospace">3x M2 standoffs</text>

      {/* Mic port openings (shown as gaps in upper sphere) */}
      {[-0.55, 0.55].map((angle, i) => {
        const a = -Math.PI/2 + angle;
        const x1 = cx + Math.cos(a) * R;
        const y1 = cy + Math.sin(a) * R;
        return (
          <g key={i}>
            <line x1={x1 - 8} y1={y1 - 8} x2={x1 + 8} y2={y1 + 8} stroke={C.mic} strokeWidth="2" />
            <line x1={x1 - 8} y1={y1 + 8} x2={x1 + 8} y2={y1 - 8} stroke={C.mic} strokeWidth="2" />
          </g>
        );
      })}
      <text x={cx - R - 90} y={cy - R * 0.4} fontSize="8" fill={C.mic} fontFamily="monospace">Mic port</text>
      <text x={cx - R - 90} y={cy - R * 0.4 + 12} fontSize="7" fill={C.muted} fontFamily="monospace">(open face)</text>

      {/* USB-C cutout in lower hemisphere */}
      <rect x={cx + baseR - 5} y={baseCutY - 25} width="10" height="5" fill={C.bg} stroke={C.usb} strokeWidth="0.8" rx="1" />
      <text x={cx + baseR + 10} y={baseCutY - 20} fontSize="7" fill={C.usb} fontFamily="monospace">USB-C</text>

      {/* Dimension: outer diameter */}
      <line x1={cx - R} y1={50} x2={cx + R} y2={50} stroke={C.dimLine} strokeWidth="0.5" />
      <line x1={cx - R} y1={45} x2={cx - R} y2={55} stroke={C.dimLine} strokeWidth="0.5" />
      <line x1={cx + R} y1={45} x2={cx + R} y2={55} stroke={C.dimLine} strokeWidth="0.5" />
      <text x={cx} y={45} textAnchor="middle" fontSize="9" fill={C.dim} fontFamily="monospace">85mm outer</text>

      {/* Dimension: wall thickness */}
      <line x1={cx + R - 8} y1={cy - R + 30} x2={cx + R} y2={cy - R + 30} stroke={C.dimLine} strokeWidth="0.5" />
      <text x={cx + R + 5} y={cy - R + 33} fontSize="7" fill={C.dim} fontFamily="monospace">2mm wall</text>

      {/* Dimension: height */}
      <line x1={cx + R + 50} y1={cy - R} x2={cx + R + 50} y2={baseCutY} stroke={C.dimLine} strokeWidth="0.5" />
      <line x1={cx + R + 45} y1={cy - R} x2={cx + R + 55} y2={cy - R} stroke={C.dimLine} strokeWidth="0.5" />
      <line x1={cx + R + 45} y1={baseCutY} x2={cx + R + 55} y2={baseCutY} stroke={C.dimLine} strokeWidth="0.5" />
      <text x={cx + R + 58} y={cy + 20} fontSize="8" fill={C.dim} fontFamily="monospace">~75mm</text>

      {/* Standoff height */}
      <line x1={cx - 60} y1={pcbY + 5} x2={cx - 60} y2={baseCutY} stroke={C.dimLine} strokeWidth="0.4" />
      <text x={cx - 85} y={(pcbY + 5 + baseCutY) / 2 + 3} fontSize="7" fill={C.dim} fontFamily="monospace">5-6mm</text>

      <text x={cx} y={510} textAnchor="middle" fontSize="10" fill={C.accent} fontWeight="600" fontFamily="system-ui, sans-serif">
        CROSS-SECTION — INTERNAL STRUCTURE
      </text>
    </svg>
  );
}

// Exploded assembly view
function ExplodedView() {
  const upperFaces = useMemo(() => renderIco({
    rx: -0.2, ry: 0.5, s: 80, ox: 400, oy: 100,
    showMic: true, showLed: true, showBase: false, showSplit: false,
    filterLower: true,
  }), []);

  const lowerFaces = useMemo(() => renderIco({
    rx: -0.2, ry: 0.5, s: 80, ox: 400, oy: 380,
    showMic: false, showLed: false, showBase: true, showSplit: false,
    filterUpper: true,
  }), []);

  return (
    <svg width="100%" height="100%" viewBox="0 0 960 540" preserveAspectRatio="xMidYMid meet">
      {/* Upper dome */}
      <Icosphere faces={upperFaces} />
      <text x="600" y="70" fontSize="10" fill={C.text} fontFamily="monospace">Upper dome</text>
      <text x="600" y="84" fontSize="8" fill={C.muted} fontFamily="monospace">Mic ports + LED glow zone</text>
      <text x="600" y="98" fontSize="8" fill={C.muted} fontFamily="monospace">Translucent PETG (optional)</text>
      <line x1="485" y1="80" x2="595" y2="80" stroke={C.dimLine} strokeWidth="0.4" strokeDasharray="2,2" />

      {/* Assembly arrows */}
      <line x1="400" y1="175" x2="400" y2="210" stroke={C.dimLine} strokeWidth="0.5" markerEnd="url(#arrowD)" />
      <line x1="400" y1="295" x2="400" y2="260" stroke={C.dimLine} strokeWidth="0.5" markerEnd="url(#arrowD)" />

      {/* PCB in the middle */}
      <g transform="translate(400, 240)">
        <ellipse cx="0" cy="0" rx="70" ry="14" fill={C.board} stroke={C.boardStroke} strokeWidth="0.8" />
        {/* LEDs on top */}
        {Array.from({length: 12}).map((_, i) => {
          const a = (i * 30) * Math.PI / 180;
          return <circle key={i} cx={Math.cos(a)*52} cy={Math.sin(a)*10} r="2.5" fill={C.led} opacity="0.6" />;
        })}
        {/* M2 holes */}
        {[0, 120, 240].map((deg, i) => {
          const a = deg * Math.PI / 180;
          return <circle key={i} cx={Math.cos(a)*58} cy={Math.sin(a)*11} r="1.5" fill="none" stroke={C.screw} strokeWidth="0.5" />;
        })}
        <text x="0" y="4" textAnchor="middle" fontSize="8" fill={C.text} fontFamily="monospace">XVF3800</text>
      </g>
      <text x="600" y="237" fontSize="10" fill={C.text} fontFamily="monospace">XVF3800 PCB</text>
      <text x="600" y="251" fontSize="8" fill={C.muted} fontFamily="monospace">70mm dia, 3x M2 mount</text>
      <line x1="475" y1="240" x2="595" y2="240" stroke={C.dimLine} strokeWidth="0.4" strokeDasharray="2,2" />

      {/* 3x M2 screws */}
      <g transform="translate(400, 200)">
        {[-30, 0, 30].map((dx, i) => (
          <g key={i}>
            <line x1={dx} y1="-5" x2={dx} y2="5" stroke={C.screw} strokeWidth="1.5" />
            <circle cx={dx} cy="-5" r="2.5" fill="none" stroke={C.screw} strokeWidth="0.5" />
          </g>
        ))}
      </g>
      <text x="200" y="202" fontSize="8" fill={C.screw} fontFamily="monospace">3x M2x4mm screws</text>
      <line x1="310" y1="200" x2="365" y2="200" stroke={C.dimLine} strokeWidth="0.4" strokeDasharray="2,2" />

      {/* Lower hemisphere */}
      <Icosphere faces={lowerFaces} />
      <text x="600" y="370" fontSize="10" fill={C.text} fontFamily="monospace">Lower hemisphere</text>
      <text x="600" y="384" fontSize="8" fill={C.muted} fontFamily="monospace">Flat base, standoffs, ports</text>
      <text x="600" y="398" fontSize="8" fill={C.muted} fontFamily="monospace">USB-C + 3.5mm cutouts</text>
      <line x1="485" y1="380" x2="595" y2="380" stroke={C.dimLine} strokeWidth="0.4" strokeDasharray="2,2" />

      {/* Standoffs in lower */}
      <g transform="translate(400, 340)">
        {[-25, 0, 25].map((dx, i) => (
          <rect key={i} x={dx-2} y="0" width="4" height="15" fill={C.screw} opacity="0.5" rx="0.5" />
        ))}
      </g>

      <text x="400" y="510" textAnchor="middle" fontSize="10" fill={C.accent} fontWeight="600" fontFamily="system-ui, sans-serif">
        EXPLODED ASSEMBLY
      </text>

      <defs>
        <marker id="arrowD" markerWidth="6" markerHeight="6" refX="3" refY="6" orient="auto">
          <path d="M0,0 L3,6 L6,0" fill="none" stroke={C.dimLine} strokeWidth="0.8" />
        </marker>
      </defs>
    </svg>
  );
}

// Compact icosphere for overview grid
function CompactIco({ rx, ry }) {
  const faces = useMemo(() => renderIco({
    rx, ry, s: 45, ox: 110, oy: 62,
    showMic: true, showLed: true, showBase: true, showSplit: false,
  }), [rx, ry]);
  return <Icosphere faces={faces} />;
}

// Specifications panel
function SpecsPanel() {
  const specs = [
    ["Component", "Dimension"],
    ["Geosphere outer diameter", "85mm"],
    ["Wall thickness", "2mm"],
    ["Subdivision level", "2 (80 triangular faces)"],
    ["Flat base diameter", "~45-50mm"],
    ["Base cut from bottom pole", "~15mm"],
    ["PCB diameter (XVF3800)", "70mm"],
    ["PCB mounting holes", "3x M2, 120\u00b0 spacing"],
    ["Standoff height", "5-6mm"],
    ["Split line", "Equator (press-fit)"],
    ["Mic port openings", "4 triangle faces, open"],
    ["USB-C cutout", "~9mm x 3.5mm"],
    ["3.5mm jack cutout", "~6.5mm diameter"],
    ["Total height", "~75mm"],
    ["Weight (shell)", "~25-30g (PETG)"],
  ];

  const features = [
    "Low poly icosphere aesthetic \u2014 80 triangular facets, visibly polygonal",
    "Flat base truncation for stable shelf/desk placement",
    "Two-piece equator split with 1mm press-fit lip",
    "4x open triangle faces for mic port acoustic access",
    "Translucent upper dome option for LED ring visibility",
    "USB-C + 3.5mm audio + JST speaker port cutouts",
    "3x M2 standoff posts for PCB mounting",
    "Optional internal CQRobot speaker shelf",
    "No supports needed for FDM printing (faceted geometry)",
    "Matte black PETG/ASA, optional smoke translucent upper",
  ];

  const assembly = [
    "Screw XVF3800 PCB into lower hemisphere standoffs (3x M2x4mm)",
    "Route USB-C cable through port cutout",
    "Optionally mount CQRobot speaker on internal shelf",
    "Press upper hemisphere onto lower (alignment tabs click)",
    "Place on shelf, plug USB into Pi 5",
  ];

  return (
    <div style={{ padding: "24px 16px", color: C.text, fontFamily: "monospace", fontSize: 13, lineHeight: 1.8 }}>
      <h2 style={{ color: C.accent, fontFamily: "system-ui, sans-serif", fontSize: 20, marginBottom: 16 }}>
        Specifications
      </h2>
      <table style={{ borderCollapse: "collapse", marginBottom: 24, width: "100%" }}>
        <tbody>
          {specs.map(([k, v], i) => (
            <tr key={i} style={{ borderBottom: "1px solid " + C.border }}>
              <td style={{ padding: "5px 16px 5px 0", color: i===0 ? C.accent : C.muted, fontWeight: i===0 ? 600 : 400 }}>{k}</td>
              <td style={{ padding: "5px 0", color: i===0 ? C.accent : C.text, fontWeight: i===0 ? 600 : 400 }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ color: C.accent, fontFamily: "system-ui, sans-serif", fontSize: 16, marginBottom: 10 }}>
        Design Features
      </h3>
      <ul style={{ paddingLeft: 18, margin: "0 0 20px" }}>
        {features.map((f, i) => <li key={i} style={{ marginBottom: 4 }}>{f}</li>)}
      </ul>

      <h3 style={{ color: C.accent, fontFamily: "system-ui, sans-serif", fontSize: 16, marginBottom: 10 }}>
        Assembly
      </h3>
      <ol style={{ paddingLeft: 18, margin: 0 }}>
        {assembly.map((a, i) => <li key={i} style={{ marginBottom: 4 }}>{a}</li>)}
      </ol>

      <h3 style={{ color: C.accent, fontFamily: "system-ui, sans-serif", fontSize: 16, margin: "20px 0 10px" }}>
        Printing
      </h3>
      <ul style={{ paddingLeft: 18, margin: 0, color: C.muted }}>
        <li>Material: Matte black PETG (upper: translucent/smoke optional)</li>
        <li>Lower half: flat base down, no supports</li>
        <li>Upper half: apex down, minimal supports</li>
        <li>Layer height: 0.15-0.2mm, 0% infill, 3-4 perimeters</li>
        <li>Brim recommended for upper half</li>
      </ul>
    </div>
  );
}

// === MAIN COMPONENT ===

const VIEWS = ["overview", "render", "front", "section", "exploded", "specs"];
const LABELS = {
  overview: "Overview", render: "Product", front: "Front",
  section: "Section", exploded: "Exploded", specs: "Specs",
};
const VIEW_TITLES = {
  overview: "Overview (All Views)",
  render: "Product Rendering",
  front: "Front View \u2014 Annotated",
  section: "Cross-Section",
  exploded: "Exploded Assembly",
  specs: "Specifications",
};

export default function TVClipMountDesign() {
  const [activeView, setActiveView] = useState("overview");

  return (
    <div style={{
      width: "100%", minHeight: "100dvh", background: C.bg,
      display: "flex", flexDirection: "column", overflow: "auto",
      fontFamily: "system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", flexDirection: "column",
        padding: "12px 16px", borderBottom: "1px solid " + C.border, flexShrink: 0, gap: 10,
      }}>
        <div>
          <span style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Comni Voice Puck</span>
          <span style={{ fontSize: 12, color: C.muted, marginLeft: 10 }}>Low Poly Geosphere</span>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {VIEWS.map(v => (
            <button key={v} onClick={() => setActiveView(v)} style={{
              background: activeView === v ? C.accent : C.panel,
              color: activeView === v ? "#fff" : C.muted,
              border: "1px solid " + (activeView === v ? C.accent : C.border),
              borderRadius: 6, padding: "6px 12px", fontSize: 12,
              cursor: "pointer", fontFamily: "system-ui, sans-serif",
              fontWeight: activeView === v ? 600 : 400,
              whiteSpace: "nowrap",
            }}>
              {LABELS[v]}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {activeView === "specs" ? (
          <div style={{ flex: 1, overflow: "auto", padding: "0 8px" }}>
            <SpecsPanel />
          </div>
        ) : activeView === "render" ? (
          <div style={{ flex: 1, minHeight: 400 }}><RenderView /></div>
        ) : activeView === "front" ? (
          <div style={{ flex: 1, minHeight: 400 }}><FrontAnnotated /></div>
        ) : activeView === "section" ? (
          <div style={{ flex: 1, minHeight: 400 }}><SectionView /></div>
        ) : activeView === "exploded" ? (
          <div style={{ flex: 1, minHeight: 400 }}><ExplodedView /></div>
        ) : (
          /* Overview: 2x2 grid */
          <div style={{
            flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "1fr 1fr", gap: 1, background: C.border, minHeight: 400,
          }}>
            {[
              { key: "render", label: "Product", rx: -0.25, ry: 0.6 },
              { key: "front", label: "Front", rx: -0.2, ry: 0.4 },
              { key: "section", label: "Cross-Section", rx: -0.1, ry: 0.0 },
              { key: "exploded", label: "Exploded", rx: -0.3, ry: 0.8 },
            ].map(({ key, label, rx, ry }) => (
              <div key={key} style={{
                background: C.bg, position: "relative", cursor: "pointer", minHeight: 180,
              }} onClick={() => setActiveView(key)}>
                <div style={{
                  position: "absolute", top: 8, left: 12, fontSize: 11,
                  color: C.muted, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1,
                }}>
                  {label}
                </div>
                {key === "section" ? (
                  <svg width="100%" height="100%" viewBox="0 0 220 125" preserveAspectRatio="xMidYMid meet">
                    <circle cx="110" cy="62" r="42" fill="none" stroke={C.shellStroke} strokeWidth="0.8" />
                    <circle cx="110" cy="62" r="39" fill="none" stroke={C.shellStroke} strokeWidth="0.3" strokeDasharray="2,2" />
                    <line x1="68" y1="89" x2="152" y2="89" stroke={C.text} strokeWidth="0.8" />
                    <line x1="65" y1="62" x2="155" y2="62" stroke={C.accent} strokeWidth="0.5" strokeDasharray="3,2" />
                    <rect x="88" y="80" width="44" height="2" fill={C.board} stroke={C.boardStroke} strokeWidth="0.4" />
                    {[-8, 0, 8].map((dx, i) => (
                      <rect key={i} x={110 + dx - 1} y="82" width="2" height="7" fill={C.screw} opacity="0.5" />
                    ))}
                  </svg>
                ) : key === "exploded" ? (
                  <svg width="100%" height="100%" viewBox="0 0 220 125" preserveAspectRatio="xMidYMid meet">
                    <CompactIco rx={-0.3} ry={0.5} />
                    <line x1="110" y1="72" x2="110" y2="85" stroke={C.dimLine} strokeWidth="0.3" strokeDasharray="1.5,1" />
                    <ellipse cx="110" cy="92" rx="28" ry="5" fill={C.board} stroke={C.boardStroke} strokeWidth="0.4" />
                  </svg>
                ) : (
                  <svg width="100%" height="100%" viewBox="0 0 220 125" preserveAspectRatio="xMidYMid meet">
                    <CompactIco rx={rx} ry={ry} />
                  </svg>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
