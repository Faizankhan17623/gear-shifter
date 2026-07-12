import { useRef, useState } from 'react';
import { motion, type PanInfo } from 'framer-motion';
import type { GearConfig, GearId } from '../shared/models';
import { GEAR_ORDER } from '../shared/models';

interface GearPosition {
  x: number;
  y: number;
}

/**
 * H-pattern gate layout mapped onto a 260x340 viewport, matching a real
 * 6-speed-plus-reverse manual gate: three parallel slots (R/1-2, 3-4, 5-.)
 * joined by one horizontal selector channel.
 */
const GEAR_POSITIONS: Record<GearId, GearPosition> = {
  R: { x: 60, y: 55 },
  '1': { x: 60, y: 170 },
  '2': { x: 60, y: 285 },
  '3': { x: 140, y: 170 },
  '4': { x: 140, y: 285 },
  '5': { x: 220, y: 170 },
};

const RAIL_X = [60, 140, 220];
const CROSSBAR_Y = 170;
const RAIL_TOP_Y = 55;
const RAIL_BOTTOM_Y = 285;

/**
 * Real H-gate travel graph: from any gear, the knob can only move in a
 * straight line to gears directly reachable on its own rail (vertical) or,
 * if it's on the crossbar row, along the crossbar to another rail
 * (horizontal) — exactly like a physical shifter, which can't cut diagonally
 * across the gate. Values are the set of gears reachable in ONE straight
 * move from the key.
 */
const REACHABLE: Record<GearId, GearId[]> = {
  R: ['1'],
  '1': ['R', '2', '3', '5'],
  '2': ['1'],
  '3': ['4', '1', '5'],
  '4': ['3'],
  '5': ['1', '3'],
};

interface GearShifterProps {
  gears: GearConfig[];
  activeGear: GearId;
  onShift: (gear: GearId) => void;
}

export default function GearShifter({ gears, activeGear, onShift }: GearShifterProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverGear, setDragOverGear] = useState<GearId | null>(null);
  const activePos = GEAR_POSITIONS[activeGear];
  const gearById = new Map(gears.map((g) => [g.gear, g]));
  const prevGearRef = useRef<GearId>(activeGear);
  const prevPos = GEAR_POSITIONS[prevGearRef.current];

  // Direction of travel for the click-to-shift throw, used to tilt the knob
  // toward the direction it's being "pushed" — the same visual cue a real
  // hand pushing a shifter gives, purely a function of start/end position
  // so it works for both click-jumps and drag releases.
  const travelDx = activePos.x - prevPos.x;
  const travelDy = activePos.y - prevPos.y;
  const tiltX = Math.max(-1, Math.min(1, travelDy / 60)) * 6; // tilt forward/back on vertical throws
  const tiltY = Math.max(-1, Math.min(1, travelDx / 60)) * -6; // tilt left/right on horizontal throws

  prevGearRef.current = activeGear;

  // Constrain free mouse movement to the physical gate: project the raw
  // pointer position onto the nearest point among the straight segments
  // that are actually reachable from the gear the drag started on, then
  // snap the live position to whichever endpoint of that segment is closer.
  // This is what makes the knob travel in straight lines like a real
  // shifter instead of drifting diagonally to an arbitrary point.
  function nearestReachableGear(x: number, y: number, from: GearId): GearId {
    const options = REACHABLE[from];
    let best: GearId = from;
    let bestDist = Infinity;
    for (const gearId of options) {
      const pos = GEAR_POSITIONS[gearId];
      const dx = pos.x - x;
      const dy = pos.y - y;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = gearId;
      }
    }
    // Also consider staying put (snapping back to the origin) if the drag
    // hasn't moved meaningfully toward any reachable neighbor.
    const originPos = GEAR_POSITIONS[from];
    const originDist = (originPos.x - x) ** 2 + (originPos.y - y) ** 2;
    if (originDist < bestDist) return from;
    return best;
  }

  // Projects the live pointer point onto the straight segment between the
  // drag's starting gear and the currently-targeted neighbor, so the knob's
  // rendered position never leaves the rail/crossbar line during a drag.
  function projectOntoSegment(x: number, y: number, from: GearPosition, to: GearPosition) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) return from;
    let t = ((x - from.x) * dx + (y - from.y) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));
    return { x: from.x + t * dx, y: from.y + t * dy };
  }

  const dragStartGearRef = useRef<GearId>(activeGear);
  const [livePos, setLivePos] = useState<GearPosition>(activePos);

  function handleDragStart() {
    dragStartGearRef.current = activeGear;
    setIsDragging(true);
  }

  function handleDrag(_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const x = info.point.x - rect.left;
    const y = info.point.y - rect.top;
    const from = dragStartGearRef.current;
    const target = nearestReachableGear(x, y, from);
    setDragOverGear(target);
    const fromPos = GEAR_POSITIONS[from];
    const toPos = GEAR_POSITIONS[target];
    setLivePos(projectOntoSegment(x, y, fromPos, toPos));
  }

  function handleDragEnd() {
    setIsDragging(false);
    const target = dragOverGear;
    setDragOverGear(null);
    if (target && target !== dragStartGearRef.current) {
      const config = gearById.get(target);
      if (config?.model) {
        onShift(target);
      }
      // If the target is locked/empty, the knob springs back to the active
      // gear automatically since `animate` re-targets activePos.
    }
  }

  const displayPos = isDragging ? livePos : activePos;

  return (
    <div className="shifter-stage" ref={stageRef}>
      {/* Console plate with a physically-cut H-gate slot (inset shadow gives it depth). */}
      <svg className="console-plate" viewBox="0 0 260 340" aria-hidden="true">
        <defs>
          <linearGradient id="plateGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#28282f" />
            <stop offset="55%" stopColor="#1c1c22" />
            <stop offset="100%" stopColor="#131316" />
          </linearGradient>
          <linearGradient id="trimGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7a7a84" />
            <stop offset="45%" stopColor="#2c2c32" />
            <stop offset="55%" stopColor="#3a3a42" />
            <stop offset="100%" stopColor="#64646c" />
          </linearGradient>
          <linearGradient id="slotWallGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#000" stopOpacity="0.9" />
            <stop offset="15%" stopColor="#000" stopOpacity="0.2" />
            <stop offset="85%" stopColor="#000" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.9" />
          </linearGradient>
          {/* brushed-metal micro-striations via fractal noise, for real surface texture */}
          <filter id="brushedMetal" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9 0.02" numOctaves="2" seed="7" result="noise" />
            <feColorMatrix in="noise" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.05 0" />
          </filter>
          <filter id="slotInset" x="-50%" y="-50%" width="200%" height="200%">
            <feOffset dx="0" dy="2" />
            <feGaussianBlur stdDeviation="2" result="offset-blur" />
            <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
            <feFlood floodColor="#000" floodOpacity="0.8" result="color" />
            <feComposite operator="in" in="color" in2="inverse" result="shadow" />
            <feComposite operator="over" in="shadow" in2="SourceGraphic" />
          </filter>
        </defs>

        {/* outer brushed-metal trim bezel, then the recessed console surface */}
        <rect x="2" y="2" width="256" height="336" rx="22" fill="url(#trimGrad)" />
        <rect x="2" y="2" width="256" height="336" rx="22" fill="url(#brushedMetal)" />
        <rect x="6" y="6" width="248" height="328" rx="18" fill="url(#plateGrad)" stroke="#000" strokeOpacity="0.5" strokeWidth="1" />
        {/* faint carbon-weave cue on the console surface */}
        <rect x="6" y="6" width="248" height="328" rx="18" fill="url(#brushedMetal)" opacity="0.4" />

        {/* the cut slots themselves, with side-wall shading for real depth */}
        <g filter="url(#slotInset)">
          {RAIL_X.map((x) => (
            <rect key={x} x={x - 6} y={RAIL_TOP_Y - 8} width="12" height={RAIL_BOTTOM_Y - RAIL_TOP_Y + 16} rx="6" fill="#08080a" />
          ))}
          <rect
            x={RAIL_X[0] - 6}
            y={CROSSBAR_Y - 6}
            width={RAIL_X[RAIL_X.length - 1] - RAIL_X[0] + 12}
            height="12"
            rx="6"
            fill="#08080a"
          />
        </g>
        {RAIL_X.map((x) => (
          <rect key={`wall-${x}`} x={x - 6} y={RAIL_TOP_Y - 8} width="12" height={RAIL_BOTTOM_Y - RAIL_TOP_Y + 16} rx="6" fill="url(#slotWallGrad)" opacity="0.7" />
        ))}

        {/* subtle brushed-metal highlight along the slot edges */}
        {RAIL_X.map((x) => (
          <rect key={`hl-${x}`} x={x - 6} y={RAIL_TOP_Y - 8} width="12" height={RAIL_BOTTOM_Y - RAIL_TOP_Y + 16} rx="6" fill="none" stroke="#000" strokeOpacity="0.4" strokeWidth="1" />
        ))}

        {/* screw rivets in the trim corners — small realism detail real consoles have */}
        {[[16, 16], [244, 16], [16, 324], [244, 324]].map(([cx, cy]) => (
          <g key={`${cx}-${cy}`}>
            <circle cx={cx} cy={cy} r="3.4" fill="#0e0e11" stroke="#050506" strokeWidth="0.6" />
            <line x1={cx - 2} y1={cy} x2={cx + 2} y2={cy} stroke="#3a3a42" strokeWidth="0.7" />
          </g>
        ))}
      </svg>

      {GEAR_ORDER.map((gearId) => {
        const pos = GEAR_POSITIONS[gearId];
        const config = gearById.get(gearId);
        const locked = !config?.model;
        const isActive = gearId === activeGear;
        const isDragTarget = isDragging && dragOverGear === gearId && gearId !== activeGear;
        // Labels sit beside the slot rather than on it, like engraved gate markings.
        // The rightmost rail (gear 5) labels to its left so the text stays on the plate;
        // every other rail labels to its right.
        const isRightmostRail = pos.x === RAIL_X[RAIL_X.length - 1];
        const labelOffsetX = isRightmostRail ? -28 : 26;

        return (
          <button
            key={gearId}
            type="button"
            className={`gear-hit${locked ? ' locked' : ''}${isActive ? ' active' : ''}${isDragTarget ? ' drag-target' : ''}`}
            style={{ left: pos.x, top: pos.y }}
            disabled={locked}
            aria-label={
              locked
                ? `Gear ${gearId}, locked, reserved for a future model`
                : `Shift to gear ${gearId}: ${config?.model?.name}`
            }
            onClick={() => !locked && onShift(gearId)}
          >
            <span
              className="gate-marking"
              style={{ transform: `translate(${labelOffsetX}px, -50%)` }}
            >
              {gearId}
            </span>
            {locked && (
              <span className="lock-icon" style={{ transform: `translate(${labelOffsetX}px, 14px)` }}>
                🔒
              </span>
            )}
          </button>
        );
      })}

      {/* GT-R-style gearstick: black leather gaiter, short gunmetal collar,
          and a round black-leather knob with cross-stitched seams. Drag it
          with the mouse into any gate slot to shift — it snaps to whichever
          gear position is nearest on release, or springs back if you drop
          it on a locked/empty slot. Clicking still works as a shortcut.

          The click-to-shift throw uses a two-phase motion to feel like a
          real mechanical shift rather than a smooth glide: a brief
          "breakaway" pause (like overcoming detent resistance before the
          lever moves), a fast decisive travel, then a spring with a touch
          of overshoot so it visibly "clunks" into the new gear and settles
          — instead of arriving pre-damped. A nested layer leans the whole
          assembly toward the direction of travel mid-throw and snaps
          upright on arrival, mimicking the knob tilting under a hand push. */}
      <motion.div
        className={`stick-assembly${isDragging ? ' dragging' : ''}`}
        onPanStart={handleDragStart}
        onPan={handleDrag}
        onPanEnd={handleDragEnd}
        animate={{ left: displayPos.x, top: displayPos.y }}
        initial={false}
        transition={
          isDragging
            ? { duration: 0 }
            : {
                left: { type: 'spring', stiffness: 260, damping: 15, mass: 1, velocity: 0, delay: 0.02 },
                top: { type: 'spring', stiffness: 260, damping: 15, mass: 1, velocity: 0, delay: 0.02 },
              }
        }
      >
        <motion.div
          className="stick-lean"
          animate={
            isDragging
              ? { rotateX: 0, rotateY: 0 }
              : { rotateX: [0, tiltX, 0], rotateY: [0, tiltY, 0] }
          }
          transition={
            isDragging
              ? { duration: 0.12 }
              : { duration: 0.32, times: [0, 0.45, 1], ease: ['easeOut', 'easeIn'] }
          }
        >
          <div className="stick-gaiter" />
          <div className="stick-collar" />
          <div className="stick-shaft" />
          <div
            key={activeGear}
            className={`stick-knob active-knob${activeGear === 'R' ? ' reverse' : ''}${!isDragging ? ' settle' : ''}`}
          >
            <div className="knob-texture" />
            <div className="knob-stitch-h" />
            <div className="knob-stitch-v" />
            <div className="knob-shine" />
            <div className="knob-shine-secondary" />
            <div className="knob-occlusion" />
          </div>
        </motion.div>
        <span className={`knob-tag${activeGear === 'R' ? ' reverse-tag' : ''}`}>
          {isDragging && dragOverGear ? dragOverGear : activeGear}
        </span>
      </motion.div>
    </div>
  );
}
