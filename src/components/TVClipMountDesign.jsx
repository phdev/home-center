import { useState } from "react";

// ReSpeaker XVF3800 TV Clip Mount — Technical Drawing
// All dimensions in mm, drawn to scale within each viewport

const COLORS = {
  bg: "#0a0a0a",
  panel: "#111",
  border: "#222",
  mount: "#2a2a2a",
  mountStroke: "#555",
  board: "#1a472a",
  boardStroke: "#3a7a4a",
  accent: "#3B82F6",
  dim: "#888",
  dimLine: "#444",
  text: "#ccc",
  muted: "#666",
  led: "#4ade80",
  pad: "#c9a030",
  usb: "#888",
  mic: "#e44",
  screw: "#999",
};

const VIEWS = ["overview", "render", "front", "side", "top", "exploded", "specs"];

function DimLine({ x1, y1, x2, y2, label, offset = 12, side = "top" }) {
  const isHoriz = Math.abs(y2 - y1) < 2;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;

  if (isHoriz) {
    const oy = side === "top" ? -offset : offset;
    return (
      <g>
        <line x1={x1} y1={y1 + oy} x2={x2} y2={y2 + oy} stroke={COLORS.dimLine} strokeWidth={0.5} />
        <line x1={x1} y1={y1} x2={x1} y2={y1 + oy} stroke={COLORS.dimLine} strokeWidth={0.3} />
        <line x1={x2} y1={y2} x2={x2} y2={y2 + oy} stroke={COLORS.dimLine} strokeWidth={0.3} />
        <line x1={x1} y1={y1 + oy} x2={x1 + 3} y2={y1 + oy - 2} stroke={COLORS.dimLine} strokeWidth={0.5} />
        <line x1={x2} y1={y2 + oy} x2={x2 - 3} y2={y2 + oy - 2} stroke={COLORS.dimLine} strokeWidth={0.5} />
        <text x={mx} y={my + oy - 3} textAnchor="middle" fontSize={5} fill={COLORS.dim} fontFamily="monospace">
          {label}
        </text>
      </g>
    );
  }
  const ox = side === "left" ? -offset : offset;
  return (
    <g>
      <line x1={x1 + ox} y1={y1} x2={x2 + ox} y2={y2} stroke={COLORS.dimLine} strokeWidth={0.5} />
      <line x1={x1} y1={y1} x2={x1 + ox} y2={y1} stroke={COLORS.dimLine} strokeWidth={0.3} />
      <line x1={x2} y1={y2} x2={x2 + ox} y2={y2} stroke={COLORS.dimLine} strokeWidth={0.3} />
      <text x={mx + ox + 3} y={my + 2} textAnchor="start" fontSize={5} fill={COLORS.dim} fontFamily="monospace">
        {label}
      </text>
    </g>
  );
}

// Front View: What you see looking at the TV from the viewer's perspective
function FrontView({ compact }) {
  const s = compact ? 1.8 : 2.5;
  const ox = compact ? 110 : 150;
  const oy = compact ? 55 : 70;

  return (
    <g transform={`translate(${ox},${oy}) scale(${s})`}>
      {/* Board - circular, face-on */}
      <circle cx={0} cy={0} r={35} fill={COLORS.board} stroke={COLORS.boardStroke} strokeWidth={0.8} />

      {/* 12 RGB LEDs ring */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 30 - 90) * Math.PI / 180;
        return (
          <circle key={i} cx={Math.cos(a) * 28} cy={Math.sin(a) * 28} r={1.8}
            fill={COLORS.led} opacity={0.6} />
        );
      })}

      {/* 3x M2 mounting holes */}
      {[0, 120, 240].map((deg, i) => {
        const a = (deg - 90) * Math.PI / 180;
        const r = 32;
        return (
          <circle key={i} cx={Math.cos(a) * r} cy={Math.sin(a) * r} r={1.2}
            fill="none" stroke={COLORS.screw} strokeWidth={0.4} />
        );
      })}

      {/* Center label */}
      <text x={0} y={-2} textAnchor="middle" fontSize={4} fill={COLORS.text} fontFamily="monospace">
        XVF3800
      </text>
      <text x={0} y={4} textAnchor="middle" fontSize={3} fill={COLORS.muted} fontFamily="monospace">
        70mm dia
      </text>

      {/* Cradle ring visible behind board */}
      <circle cx={0} cy={0} r={37} fill="none" stroke={COLORS.mountStroke} strokeWidth={1} strokeDasharray="2,2" />

      {!compact && (
        <>
          <DimLine x1={-35} y1={38} x2={35} y2={38} label="70mm" side="bottom" offset={6} />
          <text x={0} y={-42} textAnchor="middle" fontSize={5} fill={COLORS.accent} fontFamily="system-ui, sans-serif" fontWeight="600">
            FRONT VIEW
          </text>
        </>
      )}
    </g>
  );
}

// Side View (cross-section): Shows clip gripping TV bezel, cradle extending forward
function SideView({ compact }) {
  const s = compact ? 2.2 : 3;
  const ox = compact ? 110 : 150;
  const oy = compact ? 55 : 75;

  return (
    <g transform={`translate(${ox},${oy}) scale(${s})`}>
      {/* TV bezel cross-section */}
      <rect x={-5} y={-20} width={10} height={40} fill="#1a1a1a" stroke="#333" strokeWidth={0.6} rx={1} />
      <text x={0} y={26} textAnchor="middle" fontSize={3} fill={COLORS.muted} fontFamily="monospace">TV bezel</text>

      {/* Clip - back jaw (behind TV) */}
      <path d="M 5,-12 L 12,-12 L 12,12 L 5,12" fill={COLORS.mount} stroke={COLORS.mountStroke} strokeWidth={0.5} />

      {/* Clip - front jaw */}
      <path d="M -5,-12 L -8,-12 L -8,-6" fill={COLORS.mount} stroke={COLORS.mountStroke} strokeWidth={0.5} />

      {/* Clip - top bridge */}
      <path d="M -8,-12 L -8,-14 L 12,-14 L 12,-12" fill={COLORS.mount} stroke={COLORS.mountStroke} strokeWidth={0.5} />

      {/* Spring indicator */}
      <path d="M -6,-8 L -7,-6.5 L -5,-5 L -7,-3.5 L -6,-2" fill="none" stroke={COLORS.accent} strokeWidth={0.4} />

      {/* Rubber pads */}
      <rect x={-5.5} y={-11} width={1} height={4} fill={COLORS.pad} rx={0.3} opacity={0.8} />
      <rect x={4.5} y={-11} width={1} height={4} fill={COLORS.pad} rx={0.3} opacity={0.8} />

      {/* Cradle arm extending forward */}
      <path d="M -8,-14 L -45,-14 L -45,-10 L -8,-10" fill={COLORS.mount} stroke={COLORS.mountStroke} strokeWidth={0.5} />

      {/* Board in cradle (side profile) */}
      <rect x={-42} y={-16} width={34} height={2} fill={COLORS.board} stroke={COLORS.boardStroke} strokeWidth={0.4} rx={0.3} />

      {/* Cradle lip */}
      <rect x={-44} y={-16} width={1.5} height={4} fill={COLORS.mount} stroke={COLORS.mountStroke} strokeWidth={0.3} rx={0.3} />

      {/* Mic holes (bottom-firing) */}
      {[-35, -28, -21, -14].map((x, i) => (
        <g key={i}>
          <rect x={x - 1} y={-10} width={2} height={4} fill="none" stroke={COLORS.mic} strokeWidth={0.3} strokeDasharray="1,0.5" />
          <text x={x} y={-7} textAnchor="middle" fontSize={1.5} fill={COLORS.mic}>MIC</text>
        </g>
      ))}

      {/* USB-C cable routing */}
      <path d="M -42,-14 L -42,-10 L -42,10 L 8,10 L 8,5" fill="none" stroke={COLORS.usb} strokeWidth={0.4} strokeDasharray="1.5,1" />
      <text x={-30} y={13} textAnchor="middle" fontSize={2.5} fill={COLORS.usb} fontFamily="monospace">USB-C cable</text>

      {!compact && (
        <>
          {/* Dimension lines */}
          <DimLine x1={-45} y1={-20} x2={-8} y2={-20} label="~37mm cradle" side="top" offset={5} />
          <DimLine x1={-5} y1={-22} x2={5} y2={-22} label="5-25mm" side="top" offset={8} />
          <DimLine x1={15} y1={-16} x2={15} y2={-10} label="~6mm" side="right" offset={4} />
          <text x={0} y={-32} textAnchor="middle" fontSize={5} fill={COLORS.accent} fontFamily="system-ui, sans-serif" fontWeight="600">
            SIDE VIEW (CROSS-SECTION)
          </text>
        </>
      )}
    </g>
  );
}

// Top View: Looking down at the mount on the TV
function TopView({ compact }) {
  const s = compact ? 1.6 : 2.2;
  const ox = compact ? 110 : 150;
  const oy = compact ? 55 : 70;

  return (
    <g transform={`translate(${ox},${oy}) scale(${s})`}>
      {/* TV top edge */}
      <rect x={-50} y={10} width={100} height={25} fill="#1a1a1a" stroke="#333" strokeWidth={0.6} />
      <text x={0} y={25} textAnchor="middle" fontSize={3.5} fill={COLORS.muted}>TV (rear)</text>

      {/* Clip on TV */}
      <rect x={-15} y={8} width={30} height={6} fill={COLORS.mount} stroke={COLORS.mountStroke} strokeWidth={0.5} rx={1} />

      {/* Cradle arm */}
      <rect x={-8} y={-2} width={16} height={12} fill={COLORS.mount} stroke={COLORS.mountStroke} strokeWidth={0.5} rx={1} />

      {/* Board (top-down) */}
      <circle cx={0} cy={-18} r={35} fill={COLORS.board} stroke={COLORS.boardStroke} strokeWidth={0.8} />

      {/* LEDs on top */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i * 30 - 90) * Math.PI / 180;
        return (
          <circle key={i} cx={Math.cos(a) * 28} cy={-18 + Math.sin(a) * 28} r={1.5}
            fill={COLORS.led} opacity={0.5} />
        );
      })}

      {/* USB-C port */}
      <rect x={-3} y={16} width={6} height={2.5} fill={COLORS.usb} rx={0.5} />
      <text x={12} y={18.5} fontSize={2.5} fill={COLORS.usb} fontFamily="monospace">USB-C</text>

      {/* Cable routing channel */}
      <path d="M 0,18.5 L 0,35" stroke={COLORS.usb} strokeWidth={1} strokeDasharray="2,1" />

      {!compact && (
        <>
          <DimLine x1={-35} y1={-58} x2={35} y2={-58} label="70mm" side="top" offset={5} />
          <DimLine x1={42} y1={-53} x2={42} y2={35} label="~75mm protrusion" side="right" offset={4} />
          <text x={0} y={-66} textAnchor="middle" fontSize={5} fill={COLORS.accent} fontFamily="system-ui, sans-serif" fontWeight="600">
            TOP VIEW (LOOKING DOWN)
          </text>
        </>
      )}
    </g>
  );
}

// Exploded View: All parts separated vertically
function ExplodedView({ compact }) {
  const s = compact ? 1.5 : 2;
  const ox = compact ? 110 : 150;
  const oy = compact ? 10 : 10;

  return (
    <g transform={`translate(${ox},${oy}) scale(${s})`}>
      {/* Part 1: M2 screws (top) */}
      <g transform="translate(0, 5)">
        {[0, 120, 240].map((deg, i) => {
          const a = (deg - 90) * Math.PI / 180;
          const r = 25;
          return (
            <g key={i}>
              <line x1={Math.cos(a) * r} y1={Math.sin(a) * r - 3} x2={Math.cos(a) * r} y2={Math.sin(a) * r + 3}
                stroke={COLORS.screw} strokeWidth={1} />
              <circle cx={Math.cos(a) * r} cy={Math.sin(a) * r - 3} r={1.5}
                fill="none" stroke={COLORS.screw} strokeWidth={0.5} />
            </g>
          );
        })}
        <text x={30} y={2} fontSize={3.5} fill={COLORS.text} fontFamily="monospace">3x M2x4mm screws</text>
      </g>

      {/* Part 2: XVF3800 board */}
      <g transform="translate(0, 30)">
        <circle cx={0} cy={0} r={28} fill={COLORS.board} stroke={COLORS.boardStroke} strokeWidth={0.6} />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i * 30 - 90) * Math.PI / 180;
          return (
            <circle key={i} cx={Math.cos(a) * 22} cy={Math.sin(a) * 22} r={1.2} fill={COLORS.led} opacity={0.5} />
          );
        })}
        <text x={0} y={1} textAnchor="middle" fontSize={3.5} fill={COLORS.text} fontFamily="monospace">XVF3800</text>
        <text x={30} y={2} fontSize={3.5} fill={COLORS.text} fontFamily="monospace">ReSpeaker board</text>
        {/* Assembly line */}
        <line x1={0} y1={-30} x2={0} y2={-18} stroke={COLORS.dimLine} strokeWidth={0.3} strokeDasharray="1.5,1" markerEnd="url(#arrowDown)" />
      </g>

      {/* Part 3: Cradle (ring style) */}
      <g transform="translate(0, 62)">
        <circle cx={0} cy={0} r={30} fill="none" stroke={COLORS.mountStroke} strokeWidth={2} />
        <circle cx={0} cy={0} r={26} fill="none" stroke={COLORS.mountStroke} strokeWidth={0.5} strokeDasharray="2,1" />
        {/* Mic cutouts */}
        {[0, 90, 180, 270].map((deg, i) => {
          const a = (deg - 90) * Math.PI / 180;
          return (
            <rect key={i} x={Math.cos(a) * 28 - 3} y={Math.sin(a) * 28 - 2} width={6} height={4}
              fill={COLORS.bg} stroke={COLORS.mic} strokeWidth={0.3} rx={0.5}
              transform={`rotate(${deg}, ${Math.cos(a) * 28}, ${Math.sin(a) * 28})`} />
          );
        })}
        {/* Screw posts */}
        {[0, 120, 240].map((deg, i) => {
          const a = (deg - 90) * Math.PI / 180;
          return (
            <circle key={i} cx={Math.cos(a) * 25} cy={Math.sin(a) * 25} r={2}
              fill={COLORS.mount} stroke={COLORS.mountStroke} strokeWidth={0.4} />
          );
        })}
        <text x={0} y={2} textAnchor="middle" fontSize={3} fill={COLORS.text} fontFamily="monospace">cradle ring</text>
        <text x={34} y={2} fontSize={3.5} fill={COLORS.text} fontFamily="monospace">Cradle w/ mic cutouts</text>
        <line x1={0} y1={-32} x2={0} y2={-20} stroke={COLORS.dimLine} strokeWidth={0.3} strokeDasharray="1.5,1" />
      </g>

      {/* Part 4: Clip section */}
      <g transform="translate(0, 95)">
        <rect x={-12} y={-5} width={24} height={10} fill={COLORS.mount} stroke={COLORS.mountStroke} strokeWidth={0.6} rx={1.5} />
        <rect x={-4} y={5} width={8} height={8} fill={COLORS.mount} stroke={COLORS.mountStroke} strokeWidth={0.4} rx={0.5} />
        <rect x={-4} y={5} width={8} height={8} fill="none" stroke={COLORS.pad} strokeWidth={0.5} rx={0.5} strokeDasharray="1,0.5" />
        <text x={0} y={1} textAnchor="middle" fontSize={3} fill={COLORS.text} fontFamily="monospace">clip</text>
        <text x={18} y={10} fontSize={3.5} fill={COLORS.text} fontFamily="monospace">TV bezel clip</text>
        <line x1={0} y1={-7} x2={0} y2={-15} stroke={COLORS.dimLine} strokeWidth={0.3} strokeDasharray="1.5,1" />
      </g>

      {!compact && (
        <text x={0} y={-8} textAnchor="middle" fontSize={5} fill={COLORS.accent} fontFamily="system-ui, sans-serif" fontWeight="600">
          EXPLODED VIEW
        </text>
      )}

      <defs>
        <marker id="arrowDown" markerWidth="4" markerHeight="4" refX="2" refY="4" orient="auto">
          <path d="M0,0 L2,4 L4,0" fill="none" stroke={COLORS.dimLine} strokeWidth={0.5} />
        </marker>
      </defs>
    </g>
  );
}

// Render: Proportional 42" TV with mount attached
function TVRenderView() {
  // 42" TV: 930mm x 523mm. Mount is 70mm disc.
  // Scale: 1 SVG unit = ~1.5mm → TV ~620 x 349 SVG units
  const tvW = 620;
  const tvH = 349;
  const bezelW = 8; // ~12mm bezel
  const screenW = tvW - bezelW * 2;
  const screenH = tvH - bezelW * 2;
  const mountR = 23; // 70mm / 3 ≈ 23 SVG units
  const standW = 200;
  const standH = 14;
  const standBaseW = 260;
  const standBaseH = 6;

  // Center of viewport
  const cx = 480;
  const cy = 300;
  const tvX = cx - tvW / 2;
  const tvY = cy - tvH / 2 - 20;

  return (
    <svg width="100%" height="100%" viewBox="0 0 960 540" preserveAspectRatio="xMidYMid meet">
      <defs>
        {/* TV screen gradient (showing dashboard content) */}
        <linearGradient id="screenGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0d1117" />
          <stop offset="100%" stopColor="#161b22" />
        </linearGradient>
        {/* Subtle ambient glow from screen */}
        <radialGradient id="screenGlow" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
        </radialGradient>
        {/* Mount shadow */}
        <filter id="mountShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
        </filter>
        {/* LED glow */}
        <filter id="ledGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Wall texture */}
        <linearGradient id="wallGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a1a1e" />
          <stop offset="100%" stopColor="#111114" />
        </linearGradient>
        {/* Surface/shelf */}
        <linearGradient id="surfaceGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2520" />
          <stop offset="100%" stopColor="#1e1a16" />
        </linearGradient>
      </defs>

      {/* Background wall */}
      <rect x="0" y="0" width="960" height="540" fill="url(#wallGrad)" />

      {/* Surface/console under TV */}
      <rect x={cx - 340} y={tvY + tvH + standH + standBaseH + 2} width={680} height={100}
        fill="url(#surfaceGrad)" rx="2" />
      <line x1={cx - 340} y1={tvY + tvH + standH + standBaseH + 2} x2={cx + 340} y2={tvY + tvH + standH + standBaseH + 2}
        stroke="#3a3530" strokeWidth={0.5} />

      {/* TV body */}
      <rect x={tvX} y={tvY} width={tvW} height={tvH} rx={4}
        fill="#0c0c0c" stroke="#1a1a1a" strokeWidth={1.5} />

      {/* Screen */}
      <rect x={tvX + bezelW} y={tvY + bezelW} width={screenW} height={screenH} rx={2}
        fill="url(#screenGrad)" />
      <rect x={tvX + bezelW} y={tvY + bezelW} width={screenW} height={screenH} rx={2}
        fill="url(#screenGlow)" />

      {/* Dashboard content on screen (simplified) */}
      <g transform={`translate(${tvX + bezelW + 12}, ${tvY + bezelW + 8})`} opacity={0.4}>
        {/* Header bar */}
        <rect x={0} y={0} width={screenW - 24} height={16} rx={2} fill="#1e293b" />
        <text x={8} y={11} fontSize={7} fill="#94a3b8" fontFamily="system-ui">Home Center</text>
        <text x={screenW - 80} y={11} fontSize={7} fill="#64748b" fontFamily="monospace">10:42 AM</text>

        {/* Panel grid */}
        <rect x={0} y={22} width={(screenW - 36) * 0.3} height={120} rx={3} fill="#1e293b" opacity={0.6} />
        <rect x={(screenW - 36) * 0.3 + 6} y={22} width={(screenW - 36) * 0.4} height={56} rx={3} fill="#1e293b" opacity={0.6} />
        <rect x={(screenW - 36) * 0.7 + 12} y={22} width={(screenW - 36) * 0.3 - 0} height={56} rx={3} fill="#1e293b" opacity={0.6} />
        <rect x={(screenW - 36) * 0.3 + 6} y={84} width={(screenW - 36) * 0.4} height={58} rx={3} fill="#1e293b" opacity={0.6} />
        <rect x={(screenW - 36) * 0.7 + 12} y={84} width={(screenW - 36) * 0.3 - 0} height={58} rx={3} fill="#1e293b" opacity={0.6} />

        {/* Calendar panel content */}
        <text x={8} y={36} fontSize={5} fill="#64748b" fontFamily="monospace">CALENDAR</text>
        {[0, 1, 2, 3, 4].map(i => (
          <rect key={i} x={6} y={42 + i * 14} width={(screenW - 36) * 0.3 - 18} height={9} rx={1.5} fill="#0f172a" />
        ))}

        {/* Weather panel */}
        <text x={(screenW - 36) * 0.3 + 14} y={36} fontSize={5} fill="#64748b" fontFamily="monospace">WEATHER</text>
        <text x={(screenW - 36) * 0.3 + 14} y={52} fontSize={14} fill="#e2e8f0" fontFamily="system-ui">72°</text>

        {/* Photos placeholder */}
        <text x={(screenW - 36) * 0.3 + 14} y={98} fontSize={5} fill="#64748b" fontFamily="monospace">PHOTOS</text>
      </g>

      {/* TV stand */}
      <rect x={cx - standW / 2} y={tvY + tvH} width={standW} height={standH}
        fill="#111" stroke="#1a1a1a" strokeWidth={0.5} />
      <rect x={cx - standBaseW / 2} y={tvY + tvH + standH} width={standBaseW} height={standBaseH}
        fill="#0e0e0e" stroke="#1a1a1a" strokeWidth={0.5} rx={2} />

      {/* === MOUNT ON TOP OF TV === */}
      <g filter="url(#mountShadow)">
        {/* Clip (mostly hidden behind TV top) */}
        <rect x={cx - 14} y={tvY - 3} width={28} height={6}
          fill={COLORS.mount} stroke={COLORS.mountStroke} strokeWidth={0.5} rx={1.5} />

        {/* Cradle disc */}
        <circle cx={cx} cy={tvY - mountR - 1} r={mountR + 2}
          fill={COLORS.mount} stroke={COLORS.mountStroke} strokeWidth={0.8} />

        {/* Board */}
        <circle cx={cx} cy={tvY - mountR - 1} r={mountR}
          fill={COLORS.board} stroke={COLORS.boardStroke} strokeWidth={0.6} />

        {/* LED ring with glow */}
        <g filter="url(#ledGlow)">
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * 30 - 90) * Math.PI / 180;
            const ledR = mountR * 0.78;
            return (
              <circle key={i}
                cx={cx + Math.cos(a) * ledR}
                cy={tvY - mountR - 1 + Math.sin(a) * ledR}
                r={1.3} fill={COLORS.led} opacity={0.8} />
            );
          })}
        </g>
      </g>

      {/* USB-C cable (thin, running down the back — visible at top) */}
      <path d={`M ${cx} ${tvY + 1} L ${cx} ${tvY - 1}`}
        stroke="#333" strokeWidth={1.5} />

      {/* Callout line to mount */}
      <line x1={cx + mountR + 8} y1={tvY - mountR - 10}
        x2={cx + 120} y2={tvY - mountR - 40}
        stroke={COLORS.dimLine} strokeWidth={0.5} strokeDasharray="3,2" />
      <g transform={`translate(${cx + 124}, ${tvY - mountR - 48})`}>
        <rect x={-4} y={-14} width={200} height={42} rx={4}
          fill="#111" stroke={COLORS.border} strokeWidth={0.5} />
        <text x={4} y={-1} fontSize={9} fill={COLORS.accent} fontFamily="system-ui, sans-serif" fontWeight="600">
          ReSpeaker XVF3800 Mount
        </text>
        <text x={4} y={12} fontSize={7} fill={COLORS.muted} fontFamily="monospace">
          70mm disc, 12mm above bezel
        </text>
        <text x={4} y={23} fontSize={7} fill={COLORS.muted} fontFamily="monospace">
          4 mics + 12 LEDs + USB-C
        </text>
      </g>

      {/* Scale reference */}
      <g transform={`translate(${tvX + 20}, ${tvY + tvH + standH + standBaseH + 36})`}>
        <text x={0} y={0} fontSize={8} fill={COLORS.muted} fontFamily="monospace">42" Samsung TV (930 x 523mm)</text>
        <text x={0} y={14} fontSize={8} fill={COLORS.muted} fontFamily="monospace">Mount: 70mm dia — {(70 / 930 * 100).toFixed(1)}% of TV width</text>
        <text x={0} y={28} fontSize={7} fill={COLORS.dimLine} fontFamily="monospace">Proportional rendering — all dimensions to scale</text>
      </g>

      {/* Title */}
      <text x={cx} y={30} textAnchor="middle" fontSize={14} fill={COLORS.accent}
        fontFamily="system-ui, sans-serif" fontWeight="600">
        42" TV WITH CLIP MOUNT — FRONT VIEW
      </text>

      {/* Side profile inset (small) */}
      <g transform={`translate(${tvX + tvW - 180}, ${tvY + tvH + standH + standBaseH + 20})`}>
        <rect x={-6} y={-14} width={185} height={90} rx={4}
          fill="#0d0d0d" stroke={COLORS.border} strokeWidth={0.5} />
        <text x={2} y={-2} fontSize={7} fill={COLORS.muted} fontFamily="monospace" textTransform="uppercase">Side profile (not to scale)</text>

        {/* Mini side view */}
        <g transform="translate(90, 38) scale(1.8)">
          {/* TV bezel */}
          <rect x={-3} y={-18} width={6} height={36} fill="#0c0c0c" stroke="#222" strokeWidth={0.4} rx={0.5} />

          {/* Clip */}
          <path d="M -3,-8 L -5,-8 L -5,-10 L 6,-10 L 6,-8 L 3,-8" fill={COLORS.mount} stroke={COLORS.mountStroke} strokeWidth={0.3} />
          <path d="M 3,-8 L 6,-8 L 6,4 L 3,4" fill={COLORS.mount} stroke={COLORS.mountStroke} strokeWidth={0.3} />

          {/* Cradle arm */}
          <path d="M -5,-10 L -30,-10 L -30,-7 L -5,-7" fill={COLORS.mount} stroke={COLORS.mountStroke} strokeWidth={0.3} />

          {/* Board */}
          <rect x={-28} y={-12} width={23} height={1.5} fill={COLORS.board} stroke={COLORS.boardStroke} strokeWidth={0.3} />

          {/* Lip */}
          <rect x={-30} y={-12} width={1} height={3.5} fill={COLORS.mount} stroke={COLORS.mountStroke} strokeWidth={0.2} />

          {/* Cable */}
          <path d="M 0,-7 L 0,18" stroke="#333" strokeWidth={0.6} strokeDasharray="1.5,1" />
          <text x={3} y={16} fontSize={2.5} fill={COLORS.muted} fontFamily="monospace">USB-C</text>
        </g>
      </g>
    </svg>
  );
}

// Specs panel
function SpecsPanel() {
  const specs = [
    ["Component", "Dimension"],
    ["Board diameter", "70mm"],
    ["Board thickness", "~5-6mm"],
    ["Mounting holes", "3x M2, 120° spacing"],
    ["Hole inset from edge", "~3mm"],
    ["TV bezel grip range", "5-25mm"],
    ["Assembly height", "12-15mm above bezel"],
    ["Forward protrusion", "~75mm"],
    ["Cable routing", "USB-C, rear channel"],
    ["LEDs", "12x APA102 RGB (top)"],
    ["Mics", "4x MEMS (bottom-firing)"],
    ["Board weight", "~15-20g"],
    ["Material (proto)", "PETG/ASA, matte black"],
    ["Material (prod)", "ABS/PC-ABS, soft-touch"],
  ];

  const features = [
    "Spring-loaded adjustable jaw (5-25mm bezels)",
    "Silicone-padded inner surfaces (no scratches)",
    "Open-bottom cradle for bottom-firing mics",
    "USB-C cutout + rear cable routing channel",
    "Translucent LED ring or 12x light pipes",
    "Tool-free TV attachment, 3x M2 board screws",
    "Two-piece print (clip vertical, cradle horizontal)",
    "Consumer aesthetic — Google Nest Mini profile",
  ];

  return (
    <div style={{ padding: 40, color: COLORS.text, fontFamily: "monospace", fontSize: 14, lineHeight: 1.8 }}>
      <h2 style={{ color: COLORS.accent, fontFamily: "system-ui, sans-serif", fontSize: 22, marginBottom: 20 }}>
        Specifications
      </h2>
      <table style={{ borderCollapse: "collapse", marginBottom: 30, width: "100%" }}>
        <tbody>
          {specs.map(([k, v], i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              <td style={{ padding: "6px 20px 6px 0", color: i === 0 ? COLORS.accent : COLORS.muted, fontWeight: i === 0 ? 600 : 400 }}>{k}</td>
              <td style={{ padding: "6px 0", color: i === 0 ? COLORS.accent : COLORS.text, fontWeight: i === 0 ? 600 : 400 }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ color: COLORS.accent, fontFamily: "system-ui, sans-serif", fontSize: 18, marginBottom: 12 }}>
        Design Features
      </h3>
      <ul style={{ paddingLeft: 20, color: COLORS.text }}>
        {features.map((f, i) => (
          <li key={i} style={{ marginBottom: 6 }}>{f}</li>
        ))}
      </ul>

      <h3 style={{ color: COLORS.accent, fontFamily: "system-ui, sans-serif", fontSize: 18, margin: "24px 0 12px" }}>
        Assembly Sequence
      </h3>
      <ol style={{ paddingLeft: 20, color: COLORS.text }}>
        <li style={{ marginBottom: 4 }}>Clip mount onto TV top bezel (no tools)</li>
        <li style={{ marginBottom: 4 }}>Place XVF3800 board into cradle recess</li>
        <li style={{ marginBottom: 4 }}>Secure with 3x M2x4mm screws</li>
        <li style={{ marginBottom: 4 }}>Route USB-C cable through channel to Pi 5</li>
      </ol>
    </div>
  );
}

export default function TVClipMountDesign() {
  const [activeView, setActiveView] = useState("overview");

  const viewLabels = {
    overview: "Overview (All Views)",
    render: "42\" TV Rendering",
    front: "Front View",
    side: "Side Cross-Section",
    top: "Top View (Looking Down)",
    exploded: "Exploded Assembly",
    specs: "Specifications",
  };

  const buttonLabels = {
    overview: "Overview",
    render: "42\" TV",
    front: "Front",
    side: "Side",
    top: "Top",
    exploded: "Exploded",
    specs: "Specs",
  };

  return (
    <div style={{
      width: "100%", minHeight: "100dvh", background: COLORS.bg,
      display: "flex", flexDirection: "column", overflow: "auto",
      fontFamily: "system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", flexDirection: "column",
        padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0,
        gap: 10,
      }}>
        <div>
          <span style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>
            XVF3800 Clip Mount
          </span>
          <span style={{ fontSize: 12, color: COLORS.muted, marginLeft: 10 }}>
            Comni
          </span>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              style={{
                background: activeView === v ? COLORS.accent : COLORS.panel,
                color: activeView === v ? "#fff" : COLORS.muted,
                border: `1px solid ${activeView === v ? COLORS.accent : COLORS.border}`,
                borderRadius: 6, padding: "6px 12px", fontSize: 12,
                cursor: "pointer", fontFamily: "system-ui, sans-serif",
                fontWeight: activeView === v ? 600 : 400,
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              {buttonLabels[v]}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {activeView === "specs" ? (
          <div style={{ flex: 1, overflow: "auto", padding: "0 20px" }}>
            <SpecsPanel />
          </div>
        ) : activeView === "render" ? (
          <div style={{ flex: 1, minHeight: 400 }}>
            <TVRenderView />
          </div>
        ) : activeView === "overview" ? (
          /* 2x2 grid of all views */
          <div style={{
            flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "1fr 1fr", gap: 1, background: COLORS.border,
            minHeight: 400,
          }}>
            {[
              { key: "front", label: "Front", View: FrontView },
              { key: "side", label: "Side Section", View: SideView },
              { key: "top", label: "Top Down", View: TopView },
              { key: "exploded", label: "Exploded", View: ExplodedView },
            ].map(({ key, label, View }) => (
              <div key={key} style={{
                background: COLORS.bg, position: "relative",
                cursor: "pointer", minHeight: 180,
              }} onClick={() => setActiveView(key)}>
                <div style={{
                  position: "absolute", top: 8, left: 12,
                  fontSize: 11, color: COLORS.muted, fontFamily: "monospace",
                  textTransform: "uppercase", letterSpacing: 1,
                }}>
                  {label}
                </div>
                <svg width="100%" height="100%" viewBox="0 0 220 120" preserveAspectRatio="xMidYMid meet">
                  <View compact />
                </svg>
              </div>
            ))}
          </div>
        ) : (
          /* Single view */
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
            <div style={{
              fontSize: 12, color: COLORS.muted, marginBottom: 8,
              fontFamily: "monospace", letterSpacing: 1,
            }}>
              {viewLabels[activeView]}
            </div>
            <svg width="95%" height="85%" viewBox="0 0 300 160" preserveAspectRatio="xMidYMid meet" style={{ maxHeight: "70vh" }}>
              {activeView === "front" && <FrontView />}
              {activeView === "side" && <SideView />}
              {activeView === "top" && <TopView />}
              {activeView === "exploded" && <ExplodedView />}
            </svg>
          </div>
        )}

        {/* Notes panel — shown below on mobile, side on desktop */}
        {!["specs", "overview", "render"].includes(activeView) && (
          <div style={{
            borderTop: `1px solid ${COLORS.border}`,
            padding: 20, fontSize: 13, color: COLORS.muted,
            fontFamily: "monospace", lineHeight: 1.8, overflow: "auto",
          }}>
            <div style={{ color: COLORS.accent, fontSize: 14, fontWeight: 600, marginBottom: 12, fontFamily: "system-ui, sans-serif" }}>
              Notes
            </div>
            {activeView === "front" && (
              <>
                <p>Circular PCB face visible to viewer. 12 APA102 RGB LEDs form a ring for wake word feedback.</p>
                <p style={{ marginTop: 8 }}>3x M2 mounting holes at 120° intervals, ~3mm inboard from edge.</p>
                <p style={{ marginTop: 8 }}>Cradle ring (dashed) is visible as a thin lip around the board. Matte black finish blends with TV bezel.</p>
                <p style={{ marginTop: 8 }}>Total visible profile: ~74mm diameter disc, ~12mm tall from bezel top.</p>
              </>
            )}
            {activeView === "side" && (
              <>
                <p>Spring-loaded clip grips TV bezels 5-25mm thick. Silicone pads (gold) prevent scratches.</p>
                <p style={{ marginTop: 8 }}>Cradle arm extends ~37mm forward. Board sits in shallow recess with front lip.</p>
                <p style={{ marginTop: 8 }}>4x bottom-firing MEMS mics must not be blocked — cradle has cutouts at each mic position.</p>
                <p style={{ marginTop: 8 }}>USB-C cable routes through integrated channel down TV rear to Pi 5.</p>
              </>
            )}
            {activeView === "top" && (
              <>
                <p>Looking straight down at the assembly on the TV's top edge.</p>
                <p style={{ marginTop: 8 }}>Board centered on TV, clip hidden behind the bezel. Cable channel guides USB-C down the rear.</p>
                <p style={{ marginTop: 8 }}>Total forward protrusion: ~75mm from TV face (board diameter + cradle lip).</p>
              </>
            )}
            {activeView === "exploded" && (
              <>
                <p>4 components assemble without tools (except M2 screws for board).</p>
                <p style={{ marginTop: 8 }}>1. Clip onto TV bezel</p>
                <p>2. Place board in cradle recess</p>
                <p>3. Secure with 3x M2x4mm screws</p>
                <p>4. Route USB-C cable</p>
                <p style={{ marginTop: 8 }}>Two-piece 3D print recommended: clip section (vertical orientation) + cradle section (horizontal). Snap or screw together.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
