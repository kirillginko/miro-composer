"use client";

import {
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  memo,
  useCallback,
  startTransition,
} from "react";
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

// ─── Proximity colours (dot colour = distance from key) ──────────────────────
const PROXIMITY_LABEL = ["Diatonic", "Secondary", "Borrowed", "Chromatic"];
const PROXIMITY_COLOR = ["#4ade80", "#38bdf8", "#fb923c", "#f87171"];

// Circle of fifths: chromatic index → CoF position
const CHROM_TO_COF = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];

// ─── Per-score dot sizing ─────────────────────────────────────────────────────
const SCORE_R = [22, 15, 11, 8];
const SCORE_FONT = [8, 6.5, 5.5, 4.5];
const SCORE_ALPHA = [1.0, 0.9, 0.76, 0.6];

// ─── Radial ring targets for greedy placement ─────────────────────────────────
//                       diatonic  secondary  borrowed  chromatic
const ZONE_RADIUS = [80, 220, 370, 540];
const ZONE_SPREAD = [22, 40, 58, 72];
const Y_COMPRESS = 0.62;
const PAD = 5;

// ─── Cluster colours ──────────────────────────────────────────────────────────
const CLUSTER_COLORS = [
  "#a78bfa", // I   – violet
  "#f472b6", // ii  – pink
  "#34d399", // iii – emerald
  "#fbbf24", // IV  – amber
  "#60a5fa", // V   – blue
  "#fb7185", // vi  – rose
  "#94a3b8", // vii° – slate
];

// ─── Hover constants ──────────────────────────────────────────────────────────
const PUSH_RADIUS = 90;
const MAX_PUSH = 45;

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
  clusterIdx: number;
}

interface ChordCluster {
  id: string;
  label: string;
  color: string;
  cohesion: number;
  cx: number;
  cy: number;
  haloRx: number;
  haloRy: number;
}

type PosMap = Record<string, { x: number; y: number }>;

type DotAnim = {
  anim: Animation;
  id: string;
  dur: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
};
type ClusterPosAnim = {
  anim: Animation;
  id: string;
  dur: number;
  from: { cx: number; cy: number };
  to: { cx: number; cy: number };
};
type ClusterScaleAnim = {
  anim: Animation;
  id: string;
  dur: number;
  from: { sx: number; sy: number };
  to: { sx: number; sy: number };
};

// ─── Seeded random ────────────────────────────────────────────────────────────

function sr(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function gaussRand(s1: number, s2: number): [number, number] {
  const u = Math.max(sr(s1), 1e-10);
  const v = sr(s2);
  const r = Math.sqrt(-2 * Math.log(u));
  return [r * Math.cos(2 * Math.PI * v), r * Math.sin(2 * Math.PI * v)];
}

// ─── Similarity helpers ───────────────────────────────────────────────────────

function chordNoteSet(root: string, type: ChordType): Set<number> {
  const ri = NOTE_TO_INDEX[root] ?? 0;
  return new Set(CHORD_INTERVALS[type].map((i) => (ri + i) % 12));
}

function noteSimilarity(a: Set<number>, b: Set<number>): number {
  let shared = 0;
  for (const n of a) if (b.has(n)) shared++;
  return shared / Math.max(a.size, b.size);
}

// ─── Scale-overlap helpers ────────────────────────────────────────────────────

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
  const base = CHORD_INTERVALS[type].map((i) => CHROMATIC_NOTES[(ri + i) % 12]);
  const emb = CHROMATIC_NOTES[(ri + embInterval) % 12];
  const all = [...base, emb];
  return all.filter((n) => scaleNotes.includes(n)).length / all.length;
}

const EMB_ENTRIES = Object.entries(EMBELLISHMENT_INTERVALS) as [
  string,
  number,
][];

// ─── Layout cache ─────────────────────────────────────────────────────────────
// Module-level: results persist for the page lifetime (96 max entries).
// Every key/scale combination is computed at most once.
const buildDotsCache = new Map<string, ReturnType<typeof buildDots>>();

function buildDotsCached(key: string, scale: string) {
  const k = `${key}|${scale}`;
  if (!buildDotsCache.has(k)) buildDotsCache.set(k, buildDots(key, scale));
  return buildDotsCache.get(k)!;
}

function buildDots(
  key: string,
  scale: string,
): { dots: ChordDot[]; clusters: ChordCluster[] } {
  const diatonic = getDiatonicChords(key, scale);
  const scaleNotes = getScaleNotes(key, scale);
  const keyIdx = NOTE_TO_INDEX[key] ?? 0;
  const keyCof = CHROM_TO_COF[keyIdx] ?? 0;

  type Seed = {
    seedIdx: number;
    root: string;
    type: ChordType;
    noteSet: Set<number>;
    cofAngle: number;
    sortAngle: number;
  };

  const seeds: Seed[] = diatonic.map((d, i) => {
    const ri = NOTE_TO_INDEX[d.root] ?? 0;
    const cofIdx = CHROM_TO_COF[ri] ?? 0;
    const cofDist = (cofIdx - keyCof + 12) % 12;
    const cofAngle = (cofDist / 12) * Math.PI * 2 - Math.PI / 2;
    return {
      seedIdx: i,
      root: d.root,
      type: d.type as ChordType,
      noteSet: chordNoteSet(d.root, d.type),
      cofAngle,
      sortAngle: 0,
    };
  });

  const N = seeds.length;
  seeds
    .map((s, i) => ({ i, angle: s.cofAngle }))
    .sort((a, b) => a.angle - b.angle)
    .forEach(({ i }, pos) => {
      seeds[i].sortAngle = (pos / N) * Math.PI * 2 - Math.PI / 2;
    });

  const SECTOR_WIDTH = (Math.PI * 2) / N;

  type Raw = {
    root: string;
    type: ChordType;
    embellishments: string[];
    score: number;
    isDiatonic: boolean;
    seed: number;
    clusterIdx: number;
    similarityToSeed: number;
    typeIdx: number;
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

      const cNotes = chordNoteSet(root, type);
      let bestClusterIdx = 0;
      let bestSim = -1;
      seeds.forEach((s, si) => {
        const sim = noteSimilarity(cNotes, s.noteSet);
        if (sim > bestSim) {
          bestSim = sim;
          bestClusterIdx = si;
        }
      });

      raw.push({
        root,
        type,
        embellishments: [],
        score,
        isDiatonic,
        seed: ri * 137 + ti * 1009,
        clusterIdx: bestClusterIdx,
        similarityToSeed: bestSim,
        typeIdx: ti,
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
            seed: ri * 137 + ti * 1009 + (ei + 1) * 3001,
            clusterIdx: bestClusterIdx,
            similarityToSeed: bestSim,
            typeIdx: ti,
          });
        });
      }
    });
  });

  raw.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    if (a.clusterIdx !== b.clusterIdx) return a.clusterIdx - b.clusterIdx;
    return b.similarityToSeed - a.similarityToSeed;
  });

  type Placed = { x: number; y: number; r: number };
  const placed: Placed[] = [];
  const MARGIN = 56;

  function clears(x: number, y: number, r: number): boolean {
    for (const p of placed) {
      const dx = x - p.x,
        dy = y - p.y;
      if (Math.sqrt(dx * dx + dy * dy) < r + p.r + PAD) return false;
    }
    return true;
  }

  function inBounds(x: number, y: number, r: number): boolean {
    return (
      x - r >= MARGIN &&
      x + r <= SVG_W - MARGIN &&
      y - r >= MARGIN &&
      y + r <= SVG_H - MARGIN
    );
  }

  const finalPos: { x: number; y: number }[] = raw.map((c) => {
    const r = SCORE_R[c.score] ?? 8;
    const targetRad = ZONE_RADIUS[c.score] ?? 390;
    const spread = ZONE_SPREAD[c.score] ?? 65;

    const clusterAngle = seeds[c.clusterIdx].sortAngle;
    const typeOffset =
      (c.typeIdx / (CHORD_TYPES.length - 1) - 0.5) * SECTOR_WIDTH * 0.62;
    const simPull = (1 - c.similarityToSeed) * SECTOR_WIDTH * 0.14;

    const [gx, gy] = gaussRand(c.seed, c.seed + 7);
    const radialDist = Math.max(r + 4, targetRad + gx * spread * 0.48);
    const angle =
      clusterAngle +
      typeOffset +
      simPull * Math.sign(typeOffset || 1) +
      gy * 0.09;

    const px = CX + Math.cos(angle) * radialDist;
    const py = CY + Math.sin(angle) * radialDist * Y_COMPRESS;
    const cx0 = Math.max(r + MARGIN, Math.min(SVG_W - r - MARGIN, px));
    const cy0 = Math.max(r + MARGIN, Math.min(SVG_H - r - MARGIN, py));

    if (clears(cx0, cy0, r)) {
      placed.push({ x: cx0, y: cy0, r });
      return { x: cx0, y: cy0 };
    }

    const STEP = r * 2 + PAD;
    for (let rad2 = STEP; rad2 < 600; rad2 += STEP * 0.6) {
      const steps = Math.max(8, Math.round((2 * Math.PI * rad2) / STEP));
      for (let s = 0; s < steps; s++) {
        const a = (s / steps) * Math.PI * 2;
        const tx = cx0 + rad2 * Math.cos(a);
        const ty = cy0 + rad2 * Math.sin(a) * Y_COMPRESS;
        if (inBounds(tx, ty, r) && clears(tx, ty, r)) {
          placed.push({ x: tx, y: ty, r });
          return { x: tx, y: ty };
        }
      }
    }

    placed.push({ x: cx0, y: cy0, r });
    return { x: cx0, y: cy0 };
  });

  const dotPosById: Record<string, { x: number; y: number }> = {};

  const dots: ChordDot[] = raw.map((c, i) => {
    const { score } = c;
    const { x, y } = finalPos[i];
    const displayRoot = FLAT_NAMES[c.root] ?? c.root;
    const emb = c.embellishments[0] ?? "";
    const id = `${c.root}-${c.type}${emb ? `-${emb}` : ""}`;
    dotPosById[id] = { x, y };
    return {
      id,
      root: c.root,
      type: c.type,
      embellishments: c.embellishments,
      label: `${displayRoot}${TYPE_SUFFIX[c.type]}${emb}`,
      x,
      y,
      r: SCORE_R[score] ?? 8,
      fontSize: SCORE_FONT[score] ?? 3.5,
      color: PROXIMITY_COLOR[score] ?? "#4ade80",
      alpha: SCORE_ALPHA[score] ?? 0.58,
      proximityScore: score,
      isDiatonic: c.isDiatonic,
      clusterIdx: c.clusterIdx,
    };
  });

  dots.sort((a, b) => b.proximityScore - a.proximityScore);

  const clusterDotIds: string[][] = Array.from({ length: N }, () => []);
  const clusterSims: number[][] = Array.from({ length: N }, () => []);
  raw.forEach((c) => {
    const emb = c.embellishments[0] ?? "";
    const id = `${c.root}-${c.type}${emb ? `-${emb}` : ""}`;
    clusterDotIds[c.clusterIdx].push(id);
    clusterSims[c.clusterIdx].push(c.similarityToSeed);
  });

  const clusters: ChordCluster[] = seeds
    .map((seed, si) => {
      const positions = clusterDotIds[si]
        .map((id) => dotPosById[id])
        .filter((p): p is { x: number; y: number } => p != null);

      if (positions.length === 0) return null;

      const cx = positions.reduce((s, p) => s + p.x, 0) / positions.length;
      const cy = positions.reduce((s, p) => s + p.y, 0) / positions.length;

      const maxDist = Math.max(
        ...positions.map((p) => Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2)),
        30,
      );

      const sims = clusterSims[si];
      const cohesion =
        sims.length > 0 ? sims.reduce((a, b) => a + b, 0) / sims.length : 0;

      const haloR = maxDist + 30 + cohesion * 55;
      const haloRx = haloR;
      const haloRy = haloR * Y_COMPRESS * 1.1;

      const displayRoot = FLAT_NAMES[seed.root] ?? seed.root;

      return {
        id: `cluster-${si}`,
        label: `${displayRoot}${TYPE_SUFFIX[seed.type]}`,
        color: CLUSTER_COLORS[si % CLUSTER_COLORS.length],
        cohesion,
        cx,
        cy,
        haloRx,
        haloRy,
      };
    })
    .filter((c): c is ChordCluster => c !== null);

  return { dots, clusters };
}

// ─── ChordDots ────────────────────────────────────────────────────────────────
// Memoized — only re-renders when dots/animPos change.
// Hover visuals: CSS :hover on .chord-dot (no React state for hover).
// Push-away: imperative on the inner <g> via pushElsRef.
// Position: CSS set to dot.x/dot.y (final target). WAAPI immediately overrides to
// animate from old → new. No animPos state needed — one render per transition.

interface ChordDotsProps {
  dots: ChordDot[];
  posElsRef: React.MutableRefObject<Map<string, SVGGElement>>;
  pushElsRef: React.MutableRefObject<Map<string, SVGGElement>>;
  onDotEnter: (id: string) => void;
  onDotLeave: () => void;
  onDotClick: (dot: ChordDot) => void;
}

const ChordDots = memo(function ChordDots({
  dots,
  posElsRef,
  pushElsRef,
  onDotEnter,
  onDotLeave,
  onDotClick,
}: ChordDotsProps) {
  return (
    <>
      {dots.map((dot) => {
        return (
          // Outer <g>: CSS at final position. WAAPI overrides transform during animation.
          <g
            key={dot.id}
            ref={(el) => {
              if (el) posElsRef.current.set(dot.id, el);
              else posElsRef.current.delete(dot.id);
            }}
            style={{ transform: `translate(${dot.x}px, ${dot.y}px)` }}
          >
            {/* Inner <g>: imperative push-away offset + event handlers + CSS hover */}
            <g
              ref={(el) => {
                if (el) pushElsRef.current.set(dot.id, el);
                else pushElsRef.current.delete(dot.id);
              }}
              className="chord-dot"
              style={
                {
                  "--dot-alpha": dot.alpha,
                  cursor: "grab",
                } as React.CSSProperties
              }
              onMouseEnter={() => onDotEnter(dot.id)}
              onMouseLeave={onDotLeave}
              onClick={() => onDotClick(dot)}
            >
              <g className="chord-dot-inner">
                {dot.isDiatonic && (
                  <circle
                    r={dot.r + 5}
                    fill="none"
                    stroke={dot.color}
                    strokeOpacity={0.22}
                    strokeWidth="1"
                  />
                )}
                <circle
                  className="chord-dot-play-ring"
                  r={dot.r + 10}
                  fill="none"
                  stroke="#fff"
                  strokeOpacity={0.65}
                  strokeWidth="1.5"
                />
                <circle
                  r={dot.r}
                  className="chord-dot-circle"
                  fill={dot.color}
                  stroke={dot.color}
                />
                <text
                  className="chord-dot-text"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={dot.color}
                  fontSize={dot.fontSize}
                  fontWeight="700"
                  fontFamily="system-ui, sans-serif"
                  letterSpacing="0.01em"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {dot.label}
                </text>
              </g>
              {/* Expanded hit area */}
              <circle
                r={dot.r + 4}
                fill="transparent"
                style={{ pointerEvents: "all" }}
              />
            </g>
          </g>
        );
      })}
    </>
  );
});

// ─── Component ────────────────────────────────────────────────────────────────

const ChordMap = memo(function ChordMap() {
  const key = useComposerStore((s) => s.key);
  const scale = useComposerStore((s) => s.scale);

  const { dots, clusters } = useMemo(
    () => buildDotsCached(key, scale),
    [key, scale],
  );

  // hoveredId only drives the tooltip — ChordDots is memoized and ignores it
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hoveredDot = hoveredId
    ? (dots.find((d) => d.id === hoveredId) ?? null)
    : null;

  // No animPos/animClusters state — dots render at final CSS positions directly.
  // WAAPI immediately overrides CSS on commit to animate from old → new.
  // This eliminates the extra React render cycle that was causing the startup delay.
  const prevDotsRef = useRef<ChordDot[]>([]);
  const prevClustersRef = useRef<ChordCluster[]>([]);
  const posEls = useRef<Map<string, SVGGElement>>(new Map());
  const clusterEls = useRef<Map<string, SVGGElement>>(new Map());
  const haloScaleEls = useRef<Map<string, SVGGElement>>(new Map());

  const activeAnims = useRef<DotAnim[]>([]);
  const activeClusterAnims = useRef<ClusterPosAnim[]>([]);
  const activeScaleAnims = useRef<ClusterScaleAnim[]>([]);

  // ── Refs for imperative push-away ─────────────────────────────────────────
  const pushEls = useRef<Map<string, SVGGElement>>(new Map());
  const dotsRef = useRef<ChordDot[]>(dots);
  const dotsById = useRef<Map<string, ChordDot>>(new Map());
  const pushedDots = useRef<Set<string>>(new Set());

  // Keep dotsRef/dotsById current for imperative callbacks.
  useEffect(() => {
    dotsRef.current = dots;
    dotsById.current = new Map(dots.map((d) => [d.id, d]));
  }, [dots]);

  // ── Reorganisation animation (WAAPI) ──────────────────────────────────────
  // We track from/to per animation and interpolate current visual position from
  // animation.currentTime — zero getComputedStyle calls, so no forced style
  // recalculation on 200+ elements (which caused the ~1 second delay).
  useLayoutEffect(() => {
    const old = prevDotsRef.current;
    const oldClusters = prevClustersRef.current;
    prevDotsRef.current = dots;
    prevClustersRef.current = clusters;

    if (old.length === 0) return; // initial mount

    const DOT_DUR = 750;
    const CLUSTER_DUR = 950;

    // Interpolate current visual position from tracked animation state.
    // t is raw time fraction [0,1]; close enough for snap-free mid-animation handoff.
    function lerpT(anim: Animation, dur: number): number {
      const t = anim.currentTime;
      if (t === null) return 1;
      return Math.min(1, Math.max(0, (t as number) / dur));
    }

    // Build fromPos: start from static old layout positions, then override with
    // any in-flight animated position.
    const fromPos: PosMap = {};
    for (const d of old) fromPos[d.id] = { x: d.x, y: d.y };
    for (const e of activeAnims.current) {
      const p = lerpT(e.anim, e.dur);
      fromPos[e.id] = {
        x: e.from.x + (e.to.x - e.from.x) * p,
        y: e.from.y + (e.to.y - e.from.y) * p,
      };
    }

    const fromClusterPos: Record<string, { cx: number; cy: number }> = {};
    for (const c of oldClusters) fromClusterPos[c.id] = { cx: c.cx, cy: c.cy };
    for (const e of activeClusterAnims.current) {
      const p = lerpT(e.anim, e.dur);
      fromClusterPos[e.id] = {
        cx: e.from.cx + (e.to.cx - e.from.cx) * p,
        cy: e.from.cy + (e.to.cy - e.from.cy) * p,
      };
    }

    const fromClusterScale: Record<string, { sx: number; sy: number }> = {};
    for (const c of oldClusters) fromClusterScale[c.id] = { sx: 1, sy: 1 };
    for (const e of activeScaleAnims.current) {
      const p = lerpT(e.anim, e.dur);
      fromClusterScale[e.id] = {
        sx: e.from.sx + (e.to.sx - e.from.sx) * p,
        sy: e.from.sy + (e.to.sy - e.from.sy) * p,
      };
    }

    // Cancel in-progress animations
    for (const e of activeAnims.current) {
      try {
        e.anim.cancel();
      } catch {
        /* ignore */
      }
    }
    for (const e of activeClusterAnims.current) {
      try {
        e.anim.cancel();
      } catch {
        /* ignore */
      }
    }
    for (const e of activeScaleAnims.current) {
      try {
        e.anim.cancel();
      } catch {
        /* ignore */
      }
    }
    activeAnims.current = [];
    activeClusterAnims.current = [];
    activeScaleAnims.current = [];

    // Clear lingering push-away offsets
    for (const pushedId of pushedDots.current) {
      const el = pushEls.current.get(pushedId);
      if (el) {
        el.style.transition = "none";
        el.style.transform = "translate(0px, 0px)";
      }
    }
    pushedDots.current.clear();


    const EASING = "cubic-bezier(0.65, 0, 0.35, 1)";

    // Dot position animations
    const newAnims: DotAnim[] = [];
    for (const d of dots) {
      const el = posEls.current.get(d.id);
      if (!el) continue;
      // New dots (no old position) animate in from the SVG center
      const from = fromPos[d.id] ?? { x: CX, y: CY };
      const to = { x: d.x, y: d.y };
      if (Math.abs(from.x - to.x) < 1 && Math.abs(from.y - to.y) < 1) continue;
      const anim = el.animate(
        [
          { transform: `translate(${from.x}px, ${from.y}px)` },
          { transform: `translate(${to.x}px, ${to.y}px)` },
        ],
        { duration: DOT_DUR, easing: EASING, fill: "forwards" },
      );
      newAnims.push({ anim, id: d.id, dur: DOT_DUR, from, to });
    }
    activeAnims.current = newAnims;

    // Cluster position animations
    const newClusterAnims: ClusterPosAnim[] = [];
    for (const c of clusters) {
      const el = clusterEls.current.get(c.id);
      if (!el) continue;
      // New clusters animate in from the SVG center
      const from = fromClusterPos[c.id] ?? { cx: CX, cy: CY };
      if (Math.abs(from.cx - c.cx) < 1 && Math.abs(from.cy - c.cy) < 1)
        continue;
      const to = { cx: c.cx, cy: c.cy };
      const anim = el.animate(
        [
          { transform: `translate(${from.cx}px, ${from.cy}px)` },
          { transform: `translate(${to.cx}px, ${to.cy}px)` },
        ],
        { duration: CLUSTER_DUR, easing: EASING, fill: "forwards" },
      );
      newClusterAnims.push({ anim, id: c.id, dur: CLUSTER_DUR, from, to });
    }
    activeClusterAnims.current = newClusterAnims;

    // Cluster size animations (scale morph: old rx/ry → new rx/ry)
    const newScaleAnims: ClusterScaleAnim[] = [];
    for (const c of clusters) {
      const el = haloScaleEls.current.get(c.id);
      if (!el) continue;
      const oldC = oldClusters.find((oc) => oc.id === c.id);
      // New clusters scale in from near-zero
      const fs = fromClusterScale[c.id] ?? { sx: 1, sy: 1 };
      const from = oldC
        ? {
            sx: (oldC.haloRx * fs.sx) / c.haloRx,
            sy: (oldC.haloRy * fs.sy) / c.haloRy,
          }
        : { sx: 0.05, sy: 0.05 };
      const to = { sx: 1, sy: 1 };
      if (Math.abs(from.sx - 1) < 0.02 && Math.abs(from.sy - 1) < 0.02)
        continue;
      const anim = el.animate(
        [
          { transform: `scale(${from.sx}, ${from.sy})` },
          { transform: "scale(1, 1)" },
        ],
        { duration: CLUSTER_DUR, easing: EASING, fill: "forwards" },
      );
      newScaleAnims.push({ anim, id: c.id, dur: CLUSTER_DUR, from, to });
    }
    activeScaleAnims.current = newScaleAnims;

    // Cleanup: cancel all animations on unmount or before next effect run.
    // Without this, animations on unmounted DOM nodes run forever (memory leak).
    return () => {
      for (const e of activeAnims.current) { try { e.anim.cancel(); } catch { /* ignore */ } }
      for (const e of activeClusterAnims.current) { try { e.anim.cancel(); } catch { /* ignore */ } }
      for (const e of activeScaleAnims.current) { try { e.anim.cancel(); } catch { /* ignore */ } }
      activeAnims.current = [];
      activeClusterAnims.current = [];
      activeScaleAnims.current = [];
    };
  }, [dots]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pre-compute all key/scale combinations during idle time ───────────────
  useEffect(() => {
    const allScales = Object.keys(SCALE_LABELS);
    const { key: initKey, scale: initScale } = useComposerStore.getState();
    const seen = new Set<string>();
    const pairs: [string, string][] = [];
    function addPair(k: string, s: string) {
      const cacheKey = `${k}|${s}`;
      if (!seen.has(cacheKey) && !buildDotsCache.has(cacheKey)) {
        seen.add(cacheKey);
        pairs.push([k, s]);
      }
    }
    // Priority 1: all 12 keys in current scale — covers any key switch immediately
    for (const k of CHROMATIC_NOTES) addPair(k, initScale);
    // Priority 2: all scales for current key — covers scale switch
    for (const s of allScales) addPair(initKey, s);
    // Priority 3: everything else
    for (const s of allScales) for (const k of CHROMATIC_NOTES) addPair(k, s);
    if (pairs.length === 0) return;

    let i = 0;
    let handle = 0;

    // Process entries with a 10ms budget per tick, yielding between to keep
    // the browser responsive. Starts immediately after mount (no idle wait).
    function step() {
      const deadline = performance.now() + 10;
      while (i < pairs.length && performance.now() < deadline) {
        buildDotsCached(pairs[i][0], pairs[i][1]);
        i++;
      }
      if (i < pairs.length) {
        handle = setTimeout(step, 0) as unknown as number;
      }
    }

    handle = setTimeout(step, 0) as unknown as number;
    return () => clearTimeout(handle);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stable imperative callbacks ───────────────────────────────────────────

  const handleDotEnter = useCallback((id: string) => {
    startTransition(() => setHoveredId(id));

    const TRANS = "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)";

    // Reset previously pushed dots (3–8 max) — not all 200+
    for (const pushedId of pushedDots.current) {
      const el = pushEls.current.get(pushedId);
      if (el) {
        el.style.transition = TRANS;
        el.style.transform = "translate(0px, 0px)";
      }
    }
    pushedDots.current.clear();

    const hovered = dotsById.current.get(id);
    if (!hovered) return;

    for (const d of dotsRef.current) {
      if (d.id === id) continue;
      const dx = d.x - hovered.x;
      const dy = d.y - hovered.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < PUSH_RADIUS && dist > 0) {
        const strength = (1 - dist / PUSH_RADIUS) * MAX_PUSH;
        const el = pushEls.current.get(d.id);
        if (el) {
          el.style.transition = TRANS;
          el.style.transform = `translate(${(dx / dist) * strength}px, ${(dy / dist) * strength}px)`;
          pushedDots.current.add(d.id);
        }
      }
    }
  }, []); // all refs — stable

  const handleDotLeave = useCallback(() => {
    startTransition(() => setHoveredId(null));
    const TRANS = "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)";
    for (const pushedId of pushedDots.current) {
      const el = pushEls.current.get(pushedId);
      if (el) {
        el.style.transition = TRANS;
        el.style.transform = "translate(0px, 0px)";
      }
    }
    pushedDots.current.clear();
  }, []); // all refs — stable

  const handleDotClick = useCallback((dot: ChordDot) => {
    beginAudioInit();
    const { selectedChordId, octave, updateChord } =
      useComposerStore.getState();
    playChord(
      getChordNotes(dot.root, dot.type, dot.embellishments, 0, octave),
      "1n",
    );

    const el = pushEls.current.get(dot.id);
    if (el) {
      el.classList.add("chord-dot--playing");
      setTimeout(() => el.classList.remove("chord-dot--playing"), 700);
    }

    if (selectedChordId) {
      updateChord(selectedChordId, {
        root: dot.root,
        type: dot.type,
        embellishments: dot.embellishments,
      });
    }
  }, []); // reads from refs and getState() — stable

  function tooltipPos(dot: ChordDot): { tx: number; ty: number } {
    const tw = 150,
      th = 82;
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
      {/* ── SVG ── */}
      <div className="chord-map-canvas">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}
        >

          {/* ── Cluster background glows — WAAPI position + size animation ── */}
          {clusters.map((cluster) => (
            <g
              key={cluster.id}
              ref={(el) => {
                if (el) clusterEls.current.set(cluster.id, el);
                else clusterEls.current.delete(cluster.id);
              }}
              style={{
                transform: `translate(${cluster.cx}px, ${cluster.cy}px)`,
                willChange: "transform",
              }}
            >
              {/* Inner scale wrapper — WAAPI animates scale(oldSize/newSize → 1) */}
              <g
                ref={(el) => {
                  if (el) haloScaleEls.current.set(cluster.id, el);
                  else haloScaleEls.current.delete(cluster.id);
                }}
                style={{ transform: "scale(1, 1)", willChange: "transform" }}
              >
                <ellipse
                  cx={0}
                  cy={0}
                  rx={cluster.haloRx}
                  ry={cluster.haloRy}
                  fill={cluster.color}
                  fillOpacity={0.1 + cluster.cohesion * 0.12}
                  stroke="none"
                  style={{ pointerEvents: "none", filter: "blur(18px)" }}
                />
              </g>
            </g>
          ))}

          {/* ── Chord dots — memoized, WAAPI-animated positions ── */}
          <ChordDots
            dots={dots}
            posElsRef={posEls}
            pushElsRef={pushEls}
            onDotEnter={handleDotEnter}
            onDotLeave={handleDotLeave}
            onDotClick={handleDotClick}
          />

          {/* ── Tooltip — only this subtree re-renders on hover ── */}
          {hoveredDot &&
            (() => {
              const { tx, ty } = tooltipPos(hoveredDot);
              const p = hoveredDot.proximityScore;
              const clusterColor =
                CLUSTER_COLORS[hoveredDot.clusterIdx % CLUSTER_COLORS.length];
              const clusterLabel = clusters[hoveredDot.clusterIdx]?.label ?? "";
              return (
                <g style={{ pointerEvents: "none" }}>
                  <rect
                    x={tx}
                    y={ty}
                    width={150}
                    height={82}
                    rx={6}
                    fill="#161d2e"
                    stroke="#2a3555"
                    strokeWidth="1"
                  />
                  <rect
                    x={tx}
                    y={ty}
                    width={3}
                    height={82}
                    rx={3}
                    fill={hoveredDot.color}
                    fillOpacity={0.9}
                  />
                  <text
                    x={tx + 11}
                    y={ty + 21}
                    fill="#e2e8f0"
                    fontSize="15"
                    fontWeight="bold"
                    fontFamily="system-ui"
                  >
                    {hoveredDot.label}
                  </text>
                  <text
                    x={tx + 11}
                    y={ty + 36}
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
                    cy={ty + 51}
                    r={4}
                    fill={PROXIMITY_COLOR[p]}
                    fillOpacity={0.9}
                  />
                  <text
                    x={tx + 22}
                    y={ty + 55}
                    fill={PROXIMITY_COLOR[p]}
                    fontSize="9"
                    fontFamily="system-ui"
                    fontWeight="600"
                  >
                    {PROXIMITY_LABEL[p]}
                  </text>
                  <circle
                    cx={tx + 13}
                    cy={ty + 68}
                    r={4}
                    fill={clusterColor}
                    fillOpacity={0.9}
                  />
                  <text
                    x={tx + 22}
                    y={ty + 72}
                    fill={clusterColor}
                    fontSize="9"
                    fontFamily="system-ui"
                    fontWeight="600"
                  >
                    {clusterLabel} family
                  </text>
                </g>
              );
            })()}
        </svg>
      </div>
    </div>
  );
});

export default ChordMap;
