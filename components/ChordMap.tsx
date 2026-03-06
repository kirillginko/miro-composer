"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useComposerStore } from "@/store/useComposerStore";
import {
  CHROMATIC_NOTES,
  FLAT_NAMES,
  NOTE_TO_INDEX,
  getScaleNotes,
  getDiatonicChords,
  CHORD_INTERVALS,
  EMBELLISHMENT_INTERVALS,
  SCALE_LABELS,
  getChordNotes,
  type ChordType,
} from "@/lib/musicTheory";
import { playChord, beginAudioInit } from "@/lib/audioEngine";

// ─── Canvas ───────────────────────────────────────────────────────────────────

const SVG_W = 1400;
const SVG_H = 700;
const CX = SVG_W / 2;
const CY = SVG_H / 2;

// ─── Chord type metadata ──────────────────────────────────────────────────────

const CHORD_TYPES: ChordType[] = ["Maj", "Min", "Dim", "Aug", "Sus2", "Sus4"];

const TYPE_LABEL: Record<ChordType, string> = {
  Maj: "Major",
  Min: "Minor",
  Dim: "Diminished",
  Aug: "Augmented",
  Sus2: "Suspended 2nd",
  Sus4: "Suspended 4th",
};

const TYPE_SUFFIX: Record<ChordType, string> = {
  Maj: "",
  Min: "m",
  Dim: "dim",
  Aug: "aug",
  Sus2: "sus2",
  Sus4: "sus4",
};

// ─── Proximity colour system ──────────────────────────────────────────────────
// Colour encodes harmonic distance from the key — green = home, red = far away.
//                        diatonic   secondary  borrowed   chromatic
const PROXIMITY_LABEL = ["Diatonic", "Secondary", "Borrowed", "Chromatic"];
const PROXIMITY_COLOR = ["#4ade80", "#38bdf8", "#fb923c", "#f87171"];

// Circle of fifths: chromatic index → CoF position (C=0, G=1, D=2 …)
const CHROM_TO_COF = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];

// ─── Per-score visual sizing (larger = closer to key) ─────────────────────────
//                      diatonic  secondary  borrowed  chromatic
const SCORE_R = [22, 15, 11, 8]; // circle radius
const SCORE_FONT = [8, 6.5, 5.5, 4.5]; // font-size px
const SCORE_ALPHA = [1.0, 0.9, 0.76, 0.6];

// Radial ring targets: each score group lives in a ring at this distance from center
//                      diatonic  secondary  borrowed  chromatic
const ZONE_RADIUS = [80, 230, 390, 560]; // SVG units
const ZONE_SPREAD = [25, 42, 58, 75]; // random radial jitter
const Y_COMPRESS = 0.62; // flatten ellipse to fill wide canvas
const PAD = 5; // min gap between any two circles

// ─── Hover interaction constants ──────────────────────────────────────────────
const HOVER_SCALE = 1.7; // how much the hovered circle expands
const PUSH_RADIUS = 90; // distance within which neighbours are pushed
const MAX_PUSH = 45; // max pixel displacement applied to neighbours

// ─── Seeded random ────────────────────────────────────────────────────────────

function sr(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// Box-Muller transform: two uniform seeds → two standard normals
function gaussRand(s1: number, s2: number): [number, number] {
  const u = Math.max(sr(s1), 1e-10);
  const v = sr(s2);
  const r = Math.sqrt(-2 * Math.log(u));
  return [r * Math.cos(2 * Math.PI * v), r * Math.sin(2 * Math.PI * v)];
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChordDot {
  id: string;
  root: string;
  type: ChordType;
  embellishments: string[];
  label: string;
  x: number;
  y: number;
  r: number;
  fontSize: number;
  color: string;
  alpha: number;
  proximityScore: number;
  isDiatonic: boolean;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

function noteOverlap(
  root: string,
  type: ChordType,
  scaleNotes: string[],
): number {
  const ri = NOTE_TO_INDEX[root] ?? 0;
  const notes = CHORD_INTERVALS[type].map(
    (i) => CHROMATIC_NOTES[(ri + i) % 12],
  );
  return (
    notes.filter((n) => scaleNotes.includes(n)).length /
    CHORD_INTERVALS[type].length
  );
}

function noteOverlapWithEmb(
  root: string,
  type: ChordType,
  embInterval: number,
  scaleNotes: string[],
): number {
  const ri = NOTE_TO_INDEX[root] ?? 0;
  const baseNotes = CHORD_INTERVALS[type].map(
    (i) => CHROMATIC_NOTES[(ri + i) % 12],
  );
  const embNote = CHROMATIC_NOTES[(ri + embInterval) % 12];
  const allNotes = [...baseNotes, embNote];
  return (
    allNotes.filter((n) => scaleNotes.includes(n)).length / allNotes.length
  );
}

const EMB_ENTRIES = Object.entries(EMBELLISHMENT_INTERVALS) as [
  string,
  number,
][];

function buildDots(key: string, scale: string): ChordDot[] {
  const diatonic = getDiatonicChords(key, scale);
  const scaleNotes = getScaleNotes(key, scale);
  const keyIdx = NOTE_TO_INDEX[key] ?? 0;
  const keyCof = CHROM_TO_COF[keyIdx] ?? 0;

  type Raw = {
    root: string;
    type: ChordType;
    embellishments: string[];
    score: number;
    isDiatonic: boolean;
    cofAngle: number;
    seed: number;
  };
  const raw: Raw[] = [];

  CHROMATIC_NOTES.forEach((root, ri) => {
    CHORD_TYPES.forEach((type, ti) => {
      const isDiatonic = diatonic.some(
        (d) => d.root === root && d.type === type,
      );
      const overlap = noteOverlap(root, type, scaleNotes);
      const score = isDiatonic
        ? 0
        : overlap >= 0.85
          ? 1
          : overlap >= 0.5
            ? 2
            : 3;

      const rootCof = CHROM_TO_COF[ri] ?? 0;
      const cofDist = (rootCof - keyCof + 12) % 12;
      const cofAngle =
        (cofDist / 12) * Math.PI * 2 -
        Math.PI / 2 +
        (ti / CHORD_TYPES.length) * 0.48 -
        0.24;

      raw.push({
        root,
        type,
        embellishments: [],
        score,
        isDiatonic,
        cofAngle,
        seed: ri * 137 + ti * 1009,
      });

      if (isDiatonic) {
        EMB_ENTRIES.forEach(([embName, embInterval], ei) => {
          const embOverlap = noteOverlapWithEmb(
            root,
            type,
            embInterval,
            scaleNotes,
          );
          const embScore = embOverlap >= 0.85 ? 0 : embOverlap >= 0.5 ? 1 : 2;
          raw.push({
            root,
            type,
            embellishments: [embName],
            score: embScore,
            isDiatonic: false,
            cofAngle: cofAngle + (ei + 1) * 0.07,
            seed: ri * 137 + ti * 1009 + (ei + 1) * 3001,
          });
        });
      }
    });
  });

  // ── Sort: diatonic first so they get prime center positions ─────────────
  raw.sort((a, b) =>
    a.score !== b.score ? a.score - b.score : a.cofAngle - b.cofAngle,
  );

  // ── Sequential greedy placement (circle-based collision) ─────────────────
  type Placed = { x: number; y: number; r: number };
  const placed: Placed[] = [];

  function clears(x: number, y: number, r: number): boolean {
    for (const p of placed) {
      const dx = x - p.x,
        dy = y - p.y;
      if (Math.sqrt(dx * dx + dy * dy) < r + p.r + PAD) return false;
    }
    return true;
  }

  function inBounds(x: number, y: number, r: number): boolean {
    return x - r >= 4 && x + r <= SVG_W - 4 && y - r >= 4 && y + r <= SVG_H - 4;
  }

  const finalPos: { x: number; y: number }[] = raw.map((c) => {
    const r = SCORE_R[c.score] ?? 8;
    const targetRad = ZONE_RADIUS[c.score] ?? 390;
    const spread = ZONE_SPREAD[c.score] ?? 65;

    // Place in a ring at targetRad from center, angled by CoF + jitter
    const [gx, gy] = gaussRand(c.seed, c.seed + 7);
    const radialDist = Math.max(r + 4, targetRad + gx * spread * 0.55);
    const angle = c.cofAngle + gy * 0.28; // small angular jitter
    const px = CX + Math.cos(angle) * radialDist;
    const py = CY + Math.sin(angle) * radialDist * Y_COMPRESS;

    // Clamp preferred position to canvas
    const cx0 = Math.max(r + 4, Math.min(SVG_W - r - 4, px));
    const cy0 = Math.max(r + 4, Math.min(SVG_H - r - 4, py));

    // Try preferred position first
    if (clears(cx0, cy0, r)) {
      placed.push({ x: cx0, y: cy0, r });
      return { x: cx0, y: cy0 };
    }

    // Spiral outward from preferred position
    const STEP = r * 2 + PAD;
    for (let rad = STEP; rad < 600; rad += STEP * 0.6) {
      const steps = Math.max(8, Math.round((2 * Math.PI * rad) / STEP));
      for (let s = 0; s < steps; s++) {
        const angle = (s / steps) * Math.PI * 2;
        const tx = cx0 + rad * Math.cos(angle);
        const ty = cy0 + rad * Math.sin(angle) * Y_COMPRESS;
        if (inBounds(tx, ty, r) && clears(tx, ty, r)) {
          placed.push({ x: tx, y: ty, r });
          return { x: tx, y: ty };
        }
      }
    }

    // Absolute fallback — use preferred position (very rare)
    placed.push({ x: cx0, y: cy0, r });
    return { x: cx0, y: cy0 };
  });

  // ── Build final ChordDot array ────────────────────────────────────────────
  const dots: ChordDot[] = raw.map((c, i) => {
    const { score } = c;
    const r = SCORE_R[score] ?? 8;
    const { x, y } = finalPos[i];
    const displayRoot = FLAT_NAMES[c.root] ?? c.root;
    const emb = c.embellishments[0] ?? "";
    return {
      id: `${c.root}-${c.type}${emb ? `-${emb}` : ""}`,
      root: c.root,
      type: c.type,
      embellishments: c.embellishments,
      label: `${displayRoot}${TYPE_SUFFIX[c.type]}${emb}`,
      x,
      y,
      r,
      fontSize: SCORE_FONT[score] ?? 3.5,
      color: PROXIMITY_COLOR[score] ?? "#4ade80",
      alpha: SCORE_ALPHA[score] ?? 0.58,
      proximityScore: score,
      isDiatonic: c.isDiatonic,
    };
  });

  // Outer (distant) dots drawn first so inner ones render on top
  dots.sort((a, b) => b.proximityScore - a.proximityScore);
  return dots;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChordMap() {
  const key = useComposerStore((s) => s.key);
  const scale = useComposerStore((s) => s.scale);
  const globalOctave = useComposerStore((s) => s.octave);
  const selectedChordId = useComposerStore((s) => s.selectedChordId);
  const updateChord = useComposerStore((s) => s.updateChord);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const dots = useMemo(() => buildDots(key, scale), [key, scale]);
  const hoveredDot = hoveredId
    ? (dots.find((d) => d.id === hoveredId) ?? null)
    : null;

  // ── Reorganization animation ───────────────────────────────────────────────
  // When key/scale changes, dots fly from their old positions to new ones.
  type PosMap = Record<string, { x: number; y: number }>;
  const [animPos, setAnimPos] = useState<PosMap>(() =>
    Object.fromEntries(dots.map((d) => [d.id, { x: d.x, y: d.y }]))
  );
  const [reorganizing, setReorganizing] = useState(false);
  const prevDotsRef = useRef<ChordDot[]>([]);

  useEffect(() => {
    const oldPos: PosMap = {};
    for (const d of prevDotsRef.current) oldPos[d.id] = { x: d.x, y: d.y };
    prevDotsRef.current = dots;

    if (Object.keys(oldPos).length === 0) {
      // First render — place immediately with no animation
      const initPos: PosMap = {};
      for (const d of dots) initPos[d.id] = { x: d.x, y: d.y };
      setAnimPos(initPos);
      return;
    }

    // 1) Snap each dot to its previous position (no transition)
    const startPos: PosMap = {};
    for (const d of dots) startPos[d.id] = oldPos[d.id] ?? { x: CX, y: CY };
    setReorganizing(false);
    setAnimPos(startPos);

    // 2) After the browser paints the snapped frame, enable transition and
    //    move to new positions. Double rAF ensures a real paint between steps.
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        const targetPos: PosMap = {};
        for (const d of dots) targetPos[d.id] = { x: d.x, y: d.y };
        setReorganizing(true);
        setAnimPos(targetPos);
        setTimeout(() => setReorganizing(false), 750);
      });
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(raf1);
  }, [dots]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Push-away displacements for dots near the hovered one ─────────────────
  const displacements = useMemo(() => {
    const result: Record<string, { dx: number; dy: number }> = {};
    if (!hoveredId) return result;
    const hovered = dots.find((d) => d.id === hoveredId);
    if (!hovered) return result;
    for (const dot of dots) {
      if (dot.id === hoveredId) continue;
      const dx = dot.x - hovered.x;
      const dy = dot.y - hovered.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < PUSH_RADIUS && dist > 0) {
        const strength = (1 - dist / PUSH_RADIUS) * MAX_PUSH;
        result[dot.id] = {
          dx: (dx / dist) * strength,
          dy: (dy / dist) * strength,
        };
      }
    }
    return result;
  }, [dots, hoveredId]);

  function handleClick(dot: ChordDot) {
    beginAudioInit();
    playChord(
      getChordNotes(dot.root, dot.type, dot.embellishments, 0, globalOctave),
      "1n",
    );
    setPlayingId(dot.id);
    setTimeout(() => setPlayingId(null), 700);

    // Sync the currently selected timeline chord to this chord's settings
    if (selectedChordId) {
      updateChord(selectedChordId, {
        root: dot.root,
        type: dot.type,
        embellishments: dot.embellishments,
      });
    }
  }

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, dot: ChordDot) {
    e.dataTransfer.setData(
      "application/chord-def",
      JSON.stringify({
        root: dot.root,
        type: dot.type,
        embellishments: dot.embellishments,
      }),
    );
    e.dataTransfer.effectAllowed = "copy";

    const ghost = document.createElement("div");
    ghost.textContent = dot.label;
    ghost.style.cssText = [
      "position:fixed",
      "top:-100px",
      "left:-100px",
      `background:${dot.color}28`,
      `border:1px solid ${dot.color}`,
      "color:#e2e8f0",
      "padding:3px 10px",
      "border-radius:5px",
      "font-size:12px",
      "font-family:system-ui,sans-serif",
      "font-weight:600",
      "pointer-events:none",
      "white-space:nowrap",
    ].join(";");
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, (ghost.offsetWidth || 60) / 2, 14);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }

  function tooltipPos(dot: ChordDot): { tx: number; ty: number } {
    const tw = 128,
      th = 64;
    const tx =
      dot.x + dot.r + 8 + tw > SVG_W
        ? dot.x - dot.r - 8 - tw
        : dot.x + dot.r + 8;
    const ty =
      dot.y - th / 2 < 0
        ? 4
        : dot.y + th / 2 > SVG_H
          ? SVG_H - th - 4
          : dot.y - th / 2;
    return { tx, ty };
  }

  const scaleLabel = SCALE_LABELS[scale] ?? scale;
  const displayKey = FLAT_NAMES[key] ?? key;

  return (
    <div className="chord-map-inline">
      {/* ── Info bar ── */}
      <div className="chord-map-info-bar">
        <span className="chord-map-info-key">
          {displayKey}&thinsp;/&thinsp;{scaleLabel}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {PROXIMITY_LABEL.map((label, i) => (
            <span
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "10px",
                color: "#94a3b8",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: PROXIMITY_COLOR[i],
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              {label}
            </span>
          ))}
        </span>
        <span className="chord-map-info-hint">
          Click to play · Drag to timeline
        </span>
      </div>

      {/* ── SVG + interactive layer ── */}
      <div className="chord-map-canvas">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: "100%", height: "100%", display: "block" }}
        >
          <defs>
            <filter id="dotGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="#000" />

          {/* Faint ring guides — one per proximity zone */}
          {ZONE_RADIUS.map((rz, i) => (
            <ellipse
              key={i}
              cx={CX}
              cy={CY}
              rx={rz}
              ry={rz * Y_COMPRESS}
              fill="none"
              stroke={PROXIMITY_COLOR[i]}
              strokeOpacity={0.1}
              strokeWidth="1"
              strokeDasharray="4 8"
            />
          ))}

          {/* ── Chord circles ── */}
          {dots.map((dot) => {
            const isHovered = hoveredId === dot.id;
            const isPlaying = playingId === dot.id;
            const { dx = 0, dy = 0 } = displacements[dot.id] ?? {};
            const base = animPos[dot.id] ?? { x: dot.x, y: dot.y };
            const cx = base.x + dx;
            const cy = base.y + dy;
            const visualScale = isHovered ? HOVER_SCALE : 1;
            const moveTrans = reorganizing
              ? "transform 0.65s cubic-bezier(0.25,0.46,0.45,0.94)"
              : "transform 0.22s cubic-bezier(0.34,1.56,0.64,1)";

            return (
              <g
                key={dot.id}
                style={{
                  transform: `translate(${cx}px, ${cy}px)`,
                  transition: moveTrans,
                }}
              >
                {/* Scale group — grows on hover */}
                <g
                  style={{
                    transform: `scale(${visualScale})`,
                    transition: "transform 0.22s cubic-bezier(0.34,1.56,0.64,1)",
                    transformOrigin: "0px 0px",
                  }}
                >
                  {/* Diatonic outer glow ring */}
                  {dot.isDiatonic && (
                    <circle
                      r={dot.r + 5}
                      fill="none"
                      stroke={dot.color}
                      strokeOpacity={0.2}
                      strokeWidth="1"
                    />
                  )}
                  {/* Playing flash ring */}
                  {isPlaying && (
                    <circle
                      r={dot.r + 10}
                      fill="none"
                      stroke="#fff"
                      strokeOpacity={0.65}
                      strokeWidth="1.5"
                    />
                  )}
                  {/* Main filled circle */}
                  <circle
                    r={dot.r}
                    fill={dot.color}
                    fillOpacity={isHovered ? 0.28 : 0.13}
                    stroke={dot.color}
                    strokeOpacity={isHovered ? 1 : 0.72}
                    strokeWidth={isHovered ? 1.5 : 1}
                    filter={isHovered ? "url(#dotGlow)" : undefined}
                  />
                  {/* Chord name label */}
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={dot.color}
                    fontSize={dot.fontSize}
                    fontWeight="700"
                    fontFamily="system-ui, sans-serif"
                    letterSpacing="0.01em"
                    opacity={isHovered ? 1 : dot.alpha}
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {dot.label}
                  </text>
                </g>

                {/*
                  Transparent foreignObject on top for HTML5 drag + mouse events.
                  Sized to the original (unscaled) circle so hover detection is
                  stable even while the visual is animating.
                */}
                <foreignObject
                  x={-dot.r}
                  y={-dot.r}
                  width={dot.r * 2}
                  height={dot.r * 2}
                >
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, dot)}
                    onClick={() => handleClick(dot)}
                    onMouseEnter={() => setHoveredId(dot.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      cursor: "grab",
                      background: "transparent",
                    }}
                  />
                </foreignObject>
              </g>
            );
          })}

          {/* ── Tooltip ── */}
          {hoveredDot &&
            (() => {
              const { tx, ty } = tooltipPos(hoveredDot);
              const p = hoveredDot.proximityScore;
              return (
                <g style={{ pointerEvents: "none" }}>
                  <rect
                    x={tx}
                    y={ty}
                    width={140}
                    height={68}
                    rx={6}
                    fill="#161d2e"
                    stroke="#2a3555"
                    strokeWidth="1"
                  />
                  <rect
                    x={tx}
                    y={ty}
                    width={3}
                    height={68}
                    rx={3}
                    fill={hoveredDot.color}
                    fillOpacity={0.9}
                  />
                  <text
                    x={tx + 11}
                    y={ty + 22}
                    fill="#e2e8f0"
                    fontSize="15"
                    fontWeight="bold"
                    fontFamily="system-ui"
                  >
                    {hoveredDot.label}
                  </text>
                  <text
                    x={tx + 11}
                    y={ty + 38}
                    fill="#94a3b8"
                    fontSize="9"
                    fontFamily="system-ui"
                  >
                    {TYPE_LABEL[hoveredDot.type]}
                    {hoveredDot.embellishments.length > 0
                      ? ` · ${hoveredDot.embellishments.join(" ")}`
                      : ""}
                  </text>
                  <circle
                    cx={tx + 13}
                    cy={ty + 55}
                    r={4}
                    fill={PROXIMITY_COLOR[p]}
                    fillOpacity={0.9}
                  />
                  <text
                    x={tx + 22}
                    y={ty + 59}
                    fill={PROXIMITY_COLOR[p]}
                    fontSize="9"
                    fontFamily="system-ui"
                    fontWeight="600"
                  >
                    {PROXIMITY_LABEL[p]}
                  </text>
                </g>
              );
            })()}
        </svg>
      </div>
    </div>
  );
}
