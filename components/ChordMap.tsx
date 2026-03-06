"use client";

import { useState, useMemo } from "react";
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

const SVG_W    = 1000;
const SVG_H    = 580;
const CX       = SVG_W / 2;
const CY       = SVG_H / 2;
const RY_RATIO = 0.52; // flatten ellipses so they fit the wide canvas

// ─── Chord type styling ───────────────────────────────────────────────────────

const CHORD_TYPES: ChordType[] = ["Maj", "Min", "Dim", "Aug", "Sus2", "Sus4"];

const TYPE_COLOR: Record<ChordType, string> = {
  Maj: "#4a9eff",
  Min: "#ff6b6b",
  Dim: "#c084fc",
  Aug: "#fb923c",
  Sus2: "#34d399",
  Sus4: "#22d3ee",
};

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

const PROXIMITY_LABEL = ["Diatonic", "Secondary", "Borrowed", "Chromatic"];
const PROXIMITY_COLOR = ["#34d399", "#4a9eff", "#fb923c", "#a78bfa"];

// Circle of fifths: chromatic index → CoF position (C=0, G=1, D=2 …)
const CHROM_TO_COF = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];

// ─── Per-score visual sizing (larger = closer to key) ─────────────────────────
//                      diatonic  secondary  borrowed  chromatic
const SCORE_W    = [48,   36,       26,       18   ]; // SVG-unit width
const SCORE_H    = [18,   14,       10,        8   ]; // SVG-unit height
const SCORE_FONT = [ 9,    8,        7,        6   ]; // font-size px
const SCORE_CORN = [ 4,    3,        2,        2   ]; // border-radius px
const SCORE_ALPHA= [1.0,  0.88,    0.74,     0.58 ];

// Gaussian sigma for preferred positions (where each score "wants" to be)
const ZONE_SIGMA = [90, 210, 340, 440];
const Y_COMPRESS = 0.56; // flatten ellipse to fill wide canvas
const PAD        = 4;    // min gap between any two dots

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
  w: number;
  h: number;
  corner: number;
  fontSize: number;
  color: string;
  alpha: number;
  proximityScore: number;
  isDiatonic: boolean;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

function noteOverlap(root: string, type: ChordType, scaleNotes: string[]): number {
  const ri = NOTE_TO_INDEX[root] ?? 0;
  const notes = CHORD_INTERVALS[type].map((i) => CHROMATIC_NOTES[(ri + i) % 12]);
  return notes.filter((n) => scaleNotes.includes(n)).length / CHORD_INTERVALS[type].length;
}

function noteOverlapWithEmb(root: string, type: ChordType, embInterval: number, scaleNotes: string[]): number {
  const ri = NOTE_TO_INDEX[root] ?? 0;
  const baseNotes = CHORD_INTERVALS[type].map((i) => CHROMATIC_NOTES[(ri + i) % 12]);
  const embNote = CHROMATIC_NOTES[(ri + embInterval) % 12];
  const allNotes = [...baseNotes, embNote];
  return allNotes.filter((n) => scaleNotes.includes(n)).length / allNotes.length;
}

const EMB_ENTRIES = Object.entries(EMBELLISHMENT_INTERVALS) as [string, number][];

function buildDots(key: string, scale: string): ChordDot[] {
  const diatonic   = getDiatonicChords(key, scale);
  const scaleNotes = getScaleNotes(key, scale);
  const keyIdx     = NOTE_TO_INDEX[key] ?? 0;
  const keyCof     = CHROM_TO_COF[keyIdx] ?? 0;

  type Raw = {
    root: string; type: ChordType; embellishments: string[];
    score: number; isDiatonic: boolean; cofAngle: number; seed: number;
  };
  const raw: Raw[] = [];

  CHROMATIC_NOTES.forEach((root, ri) => {
    CHORD_TYPES.forEach((type, ti) => {
      const isDiatonic = diatonic.some((d) => d.root === root && d.type === type);
      const overlap    = noteOverlap(root, type, scaleNotes);
      const score      = isDiatonic ? 0 : overlap >= 0.85 ? 1 : overlap >= 0.5 ? 2 : 3;

      const rootCof  = CHROM_TO_COF[ri] ?? 0;
      const cofDist  = (rootCof - keyCof + 12) % 12;
      const cofAngle = (cofDist / 12) * Math.PI * 2 - Math.PI / 2
                     + (ti / CHORD_TYPES.length) * 0.48 - 0.24;

      raw.push({ root, type, embellishments: [], score, isDiatonic, cofAngle, seed: ri * 137 + ti * 1009 });

      if (isDiatonic) {
        EMB_ENTRIES.forEach(([embName, embInterval], ei) => {
          const embOverlap = noteOverlapWithEmb(root, type, embInterval, scaleNotes);
          const embScore   = embOverlap >= 0.85 ? 0 : embOverlap >= 0.5 ? 1 : 2;
          raw.push({
            root, type, embellishments: [embName],
            score: embScore, isDiatonic: false,
            cofAngle: cofAngle + (ei + 1) * 0.07,
            seed: ri * 137 + ti * 1009 + (ei + 1) * 3001,
          });
        });
      }
    });
  });

  // ── Sort: diatonic first so they get prime center positions ─────────────
  raw.sort((a, b) => a.score !== b.score ? a.score - b.score : a.cofAngle - b.cofAngle);

  // ── Sequential greedy placement ──────────────────────────────────────────
  // Place each dot at its preferred gaussian position; if occupied, spiral
  // outward until a clear spot is found. Guarantees zero overlap with zero
  // edge-piling because we never force-push into walls.
  type Placed = { x: number; y: number; w: number; h: number };
  const placed: Placed[] = [];

  function clears(x: number, y: number, w: number, h: number): boolean {
    for (const p of placed) {
      if (Math.abs(x - p.x) < (w + p.w) / 2 + PAD &&
          Math.abs(y - p.y) < (h + p.h) / 2 + PAD) return false;
    }
    return true;
  }

  function inBounds(x: number, y: number, w: number, h: number): boolean {
    return x - w / 2 >= 4 && x + w / 2 <= SVG_W - 4 &&
           y - h / 2 >= 4 && y + h / 2 <= SVG_H - 4;
  }

  const finalPos: { x: number; y: number }[] = raw.map((c) => {
    const w     = SCORE_W[c.score]    ?? 18;
    const h     = SCORE_H[c.score]    ?? 8;
    const sigma = ZONE_SIGMA[c.score] ?? 440;

    // Preferred position: gaussian around a CoF-biased centre
    const [gx, gy] = gaussRand(c.seed, c.seed + 7);
    const biasDist  = sigma * 0.20;
    const px = CX + Math.cos(c.cofAngle) * biasDist + gx * sigma * 0.80;
    const py = CY + Math.sin(c.cofAngle) * biasDist * Y_COMPRESS
                  + gy * sigma * 0.80 * Y_COMPRESS;

    // Clamp preferred position to canvas
    const cx0 = Math.max(w / 2 + 4, Math.min(SVG_W - w / 2 - 4, px));
    const cy0 = Math.max(h / 2 + 4, Math.min(SVG_H - h / 2 - 4, py));

    // Try preferred position first
    if (clears(cx0, cy0, w, h)) {
      placed.push({ x: cx0, y: cy0, w, h });
      return { x: cx0, y: cy0 };
    }

    // Spiral outward from preferred position
    const STEP = Math.max(w, h) + PAD;
    for (let r = STEP; r < 600; r += STEP * 0.6) {
      const steps = Math.max(8, Math.round((2 * Math.PI * r) / STEP));
      for (let s = 0; s < steps; s++) {
        const angle = (s / steps) * Math.PI * 2;
        const tx = cx0 + r * Math.cos(angle);
        const ty = cy0 + r * Math.sin(angle) * Y_COMPRESS;
        if (inBounds(tx, ty, w, h) && clears(tx, ty, w, h)) {
          placed.push({ x: tx, y: ty, w, h });
          return { x: tx, y: ty };
        }
      }
    }

    // Absolute fallback — use preferred position (very rare)
    placed.push({ x: cx0, y: cy0, w, h });
    return { x: cx0, y: cy0 };
  });

  // ── Build final ChordDot array ────────────────────────────────────────────
  const dots: ChordDot[] = raw.map((c, i) => {
    const { score } = c;
    const w = SCORE_W[score] ?? 18;
    const h = SCORE_H[score] ?? 8;
    const { x, y } = finalPos[i];
    const displayRoot = FLAT_NAMES[c.root] ?? c.root;
    const emb = c.embellishments[0] ?? "";
    return {
      id:             `${c.root}-${c.type}${emb ? `-${emb}` : ""}`,
      root:           c.root,
      type:           c.type,
      embellishments: c.embellishments,
      label:          `${displayRoot}${TYPE_SUFFIX[c.type]}${emb}`,
      x, y, w, h,
      corner:         SCORE_CORN[score]  ?? 2,
      fontSize:       SCORE_FONT[score]  ?? 6,
      color:          TYPE_COLOR[c.type],
      alpha:          SCORE_ALPHA[score] ?? 0.58,
      proximityScore: score,
      isDiatonic:     c.isDiatonic,
    };
  });

  // Outer (distant) dots drawn first so inner ones render on top
  dots.sort((a, b) => b.proximityScore - a.proximityScore);
  return dots;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChordMap() {
  const key   = useComposerStore((s) => s.key);
  const scale = useComposerStore((s) => s.scale);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const dots       = useMemo(() => buildDots(key, scale), [key, scale]);
  const hoveredDot = hoveredId ? (dots.find((d) => d.id === hoveredId) ?? null) : null;

  function handleClick(dot: ChordDot) {
    beginAudioInit();
    playChord(getChordNotes(dot.root, dot.type, dot.embellishments, 0, 4), "1n");
    setPlayingId(dot.id);
    setTimeout(() => setPlayingId(null), 700);
  }

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, dot: ChordDot) {
    e.dataTransfer.setData(
      "application/chord-def",
      JSON.stringify({ root: dot.root, type: dot.type, embellishments: dot.embellishments })
    );
    e.dataTransfer.effectAllowed = "copy";

    const ghost = document.createElement("div");
    ghost.textContent = dot.label;
    ghost.style.cssText = [
      "position:fixed", "top:-100px", "left:-100px",
      `background:${dot.color}28`, `border:1px solid ${dot.color}`,
      "color:#e2e8f0", "padding:3px 10px", "border-radius:5px",
      "font-size:12px", "font-family:system-ui,sans-serif",
      "font-weight:600", "pointer-events:none", "white-space:nowrap",
    ].join(";");
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, (ghost.offsetWidth || 60) / 2, 14);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }

  function tooltipPos(dot: ChordDot): { tx: number; ty: number } {
    const tw = 128, th = 64;
    const tx = dot.x + dot.w / 2 + 8 + tw > SVG_W
      ? dot.x - dot.w / 2 - 8 - tw
      : dot.x + dot.w / 2 + 8;
    const ty = dot.y - th / 2 < 0     ? 4
      : dot.y + th / 2 > SVG_H        ? SVG_H - th - 4
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
        <span className="chord-map-info-hint">Click to play · Drag to timeline</span>
      </div>

      {/* ── SVG + interactive layer ── */}
      <div className="chord-map-canvas">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: "100%", height: "100%", display: "block" }}
        >
          <defs>
            <radialGradient id="cmGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#1a2540" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#0a0e1a" stopOpacity="0"   />
            </radialGradient>
            <filter id="cloudBlur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="38" />
            </filter>
            <filter id="cloudBlurSm" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="22" />
            </filter>
          </defs>
          <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="#0a0e1a" />
          <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="url(#cmGlow)" />

          {/* Soft cloud glow layers per proximity zone */}
          <ellipse cx={CX} cy={CY} rx={520} ry={300}
            fill={`${PROXIMITY_COLOR[3]}07`} filter="url(#cloudBlur)" />
          <ellipse cx={CX} cy={CY} rx={360} ry={210}
            fill={`${PROXIMITY_COLOR[2]}09`} filter="url(#cloudBlur)" />
          <ellipse cx={CX} cy={CY} rx={210} ry={125}
            fill={`${PROXIMITY_COLOR[1]}0c`} filter="url(#cloudBlurSm)" />
          <ellipse cx={CX} cy={CY} rx={100} ry={62}
            fill={`${PROXIMITY_COLOR[0]}14`} filter="url(#cloudBlurSm)" />

          {/* ── Chord squares ── */}
          {dots.map((dot) => {
            const isHovered = hoveredId === dot.id;
            const isPlaying = playingId === dot.id;

            return (
              <g key={dot.id}>
                {/* Diatonic outer glow */}
                {dot.isDiatonic && (
                  <rect
                    x={dot.x - dot.w / 2 - 5} y={dot.y - dot.h / 2 - 5}
                    width={dot.w + 10} height={dot.h + 10}
                    rx={dot.corner + 3}
                    fill="none" stroke={dot.color}
                    strokeOpacity={0.22} strokeWidth="1" />
                )}
                {/* Hover ring */}
                {isHovered && (
                  <rect
                    x={dot.x - dot.w / 2 - 5} y={dot.y - dot.h / 2 - 5}
                    width={dot.w + 10} height={dot.h + 10}
                    rx={dot.corner + 3}
                    fill="none" stroke={dot.color}
                    strokeOpacity={0.75} strokeWidth="1.5" />
                )}
                {/* Playing flash */}
                {isPlaying && (
                  <rect
                    x={dot.x - dot.w / 2 - 9} y={dot.y - dot.h / 2 - 9}
                    width={dot.w + 18} height={dot.h + 18}
                    rx={dot.corner + 6}
                    fill="none" stroke="#fff"
                    strokeOpacity={0.7} strokeWidth="1.5" />
                )}

                {/*
                  foreignObject wraps a real HTML <div> so the browser's
                  native HTML5 drag API fires correctly. SVG elements ignore
                  the draggable attribute.
                */}
                <foreignObject
                  x={dot.x - dot.w / 2}
                  y={dot.y - dot.h / 2}
                  width={dot.w}
                  height={dot.h}
                >
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, dot)}
                    onClick={() => handleClick(dot)}
                    onMouseEnter={() => setHoveredId(dot.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      width:          "100%",
                      height:         "100%",
                      boxSizing:      "border-box",
                      background:     "rgba(10,14,26,0.9)",
                      border:         `1px solid ${dot.color}${isHovered ? "ff" : "99"}`,
                      borderRadius:   `${dot.corner}px`,
                      display:        "flex",
                      alignItems:     "center",
                      justifyContent: "center",
                      color:          dot.color,
                      fontSize:       `${dot.fontSize}px`,
                      fontWeight:     "600",
                      fontFamily:     "system-ui, sans-serif",
                      letterSpacing:  "0.01em",
                      cursor:         "grab",
                      userSelect:     "none",
                      opacity:        isHovered ? 1 : dot.alpha,
                      overflow:       "hidden",
                      whiteSpace:     "nowrap",
                    }}
                  >
                    {dot.label}
                  </div>
                </foreignObject>
              </g>
            );
          })}

          {/* ── Tooltip ── */}
          {hoveredDot && (() => {
            const { tx, ty } = tooltipPos(hoveredDot);
            const p = hoveredDot.proximityScore;
            return (
              <g style={{ pointerEvents: "none" }}>
                <rect x={tx} y={ty} width={128} height={64} rx={6}
                  fill="#161d2e" stroke="#2a3555" strokeWidth="1" />
                <rect x={tx} y={ty} width={3} height={64} rx={3}
                  fill={hoveredDot.color} fillOpacity={0.9} />
                <text x={tx + 11} y={ty + 21}
                  fill="#e2e8f0" fontSize="15" fontWeight="bold" fontFamily="system-ui">
                  {hoveredDot.label}
                </text>
                <text x={tx + 11} y={ty + 37}
                  fill="#718096" fontSize="9" fontFamily="system-ui">
                  {TYPE_LABEL[hoveredDot.type]}
                </text>
                <circle cx={tx + 12} cy={ty + 52} r={3} fill={PROXIMITY_COLOR[p]} />
                <text x={tx + 19} y={ty + 56}
                  fill={PROXIMITY_COLOR[p]} fontSize="9" fontFamily="system-ui">
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
