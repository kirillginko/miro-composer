"use client";

import { useMemo, useState, useCallback } from "react";
import { useComposerStore } from "@/store/useComposerStore";
import {
  getDiatonicChords,
  getChordNotes,
  FLAT_NAMES,
  CHROMATIC_NOTES,
  NOTE_TO_INDEX,
  type ChordType,
} from "@/lib/musicTheory";
import { playChord, beginAudioInit } from "@/lib/audioEngine";

const TYPE_SUFFIX: Record<ChordType, string> = {
  Maj: "",
  Min: "m",
  Dim: "dim",
  Aug: "aug",
  Sus2: "sus2",
  Sus4: "sus4",
};

// Which diatonic degrees commonly follow each degree
const PROGRESSION_MAP: Record<number, number[]> = {
  0: [3, 4, 5],
  1: [4, 0],
  2: [3, 5],
  3: [4, 0, 1],
  4: [0, 5],
  5: [3, 1],
  6: [0],
};

// Colour per suggestion category
const DOT_COLORS = {
  next: "#4ade80", // green  — strongly suggested next (diatonic)
  secondary: "#fbbf24", // gold   — secondary dominant (V7/x)
  borrowed: "#a78bfa", // violet — borrowed from parallel mode
  tritone: "#fb923c", // orange — tritone substitution
  diatonic: "#94a3b8", // slate  — remaining diatonic
};

interface Suggestion {
  root: string;
  type: ChordType;
  embellishments: string[];
  label: string;
  color: string;
  isNext: boolean;
}

// Build the label string for a chord
function chordLabel(root: string, type: ChordType, emb?: string): string {
  const display = FLAT_NAMES[root] ?? root;
  return `${display}${TYPE_SUFFIX[type]}${emb ?? ""}`;
}

// Secondary dominants: for each target diatonic degree, the dominant 7th chord
// built a perfect 5th above it (Maj + "7" = dominant 7th sound).
// Degrees 1–5 are tonicizable; avoid tonicizing dim chords.
function getSecondaryDominants(
  key: string,
  scale: string,
  priorityDegrees: number[],
): Suggestion[] {
  const diatonic = getDiatonicChords(key, scale);
  const seen = new Set<string>();
  const results: Suggestion[] = [];

  // Priority degrees first, then the rest (1–5 skipping dim)
  const allDegrees = [
    ...priorityDegrees,
    ...[1, 2, 3, 4, 5].filter((d) => !priorityDegrees.includes(d)),
  ];

  allDegrees.forEach((deg) => {
    const target = diatonic[deg];
    if (!target || target.type === "Dim") return;

    const targetIdx = NOTE_TO_INDEX[target.root] ?? 0;
    const secRoot = CHROMATIC_NOTES[(targetIdx + 7) % 12];
    const id = `${secRoot}-Maj-7`;
    if (seen.has(id)) return;
    seen.add(id);

    results.push({
      root: secRoot,
      type: "Maj",
      embellishments: ["7"],
      label: chordLabel(secRoot, "Maj", "7"),
      color: DOT_COLORS.secondary,
      isNext: priorityDegrees.includes(deg),
    });
  });

  return results;
}

// Borrowed chords from the parallel mode
function getBorrowedChords(key: string, scale: string): Suggestion[] {
  const keyIdx = NOTE_TO_INDEX[key] ?? 0;
  const results: Suggestion[] = [];

  function add(semitones: number, type: ChordType, emb?: string) {
    const root = CHROMATIC_NOTES[(keyIdx + semitones) % 12];
    results.push({
      root,
      type,
      embellishments: emb ? [emb] : [],
      label: chordLabel(root, type, emb),
      color: DOT_COLORS.borrowed,
      isNext: false,
    });
  }

  if (scale === "major") {
    // Borrowed from parallel natural minor (modal mixture)
    add(10, "Maj"); // bVII  (e.g. Bb in C)
    add(8, "Maj"); // bVI   (e.g. Ab in C)
    add(3, "Maj"); // bIII  (e.g. Eb in C)
    add(5, "Min"); // iv    (e.g. Fm in C — minor subdominant)
    add(10, "Maj", "7"); // bVII7
    add(8, "Maj", "maj7"); // bVImaj7
  } else if (
    scale === "naturalMinor" ||
    scale === "harmonicMinor" ||
    scale === "melodicMinor"
  ) {
    // Borrowed from parallel major
    add(5, "Maj"); // IV major (raised subdominant)
    add(0, "Maj"); // I major  (Picardy third)
    add(5, "Maj", "7"); // IV7
    add(10, "Maj"); // bVII (common in rock/pop minor)
  } else {
    // Modal keys — borrow a few cross-modal choices
    add(10, "Maj"); // bVII
    add(8, "Maj"); // bVI
    add(3, "Maj"); // bIII
  }

  return results;
}

export function ChordSuggestionBar() {
  const key = useComposerStore((s) => s.key);
  const scale = useComposerStore((s) => s.scale);
  const octave = useComposerStore((s) => s.octave);
  const timeline = useComposerStore((s) => s.timeline);
  const selectedChordId = useComposerStore((s) => s.selectedChordId);
  const addChord = useComposerStore((s) => s.addChord);
  const setPreviewChord = useComposerStore((s) => s.setPreviewChord);

  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const suggestions = useMemo<Suggestion[]>(() => {
    const diatonic = getDiatonicChords(key, scale);
    const keyIdx = NOTE_TO_INDEX[key] ?? 0;
    const seen = new Set<string>();
    const results: Suggestion[] = [];

    function push(s: Suggestion) {
      const id = `${s.root}-${s.type}-${s.embellishments[0] ?? ""}`;
      if (seen.has(id)) return;
      seen.add(id);
      results.push(s);
    }

    // ── Current chord context ─────────────────────────────────────────────────
    const selectedChord = selectedChordId
      ? (timeline.find((c) => c.id === selectedChordId) ?? null)
      : null;

    const currentDegree = selectedChord
      ? diatonic.findIndex(
          (d) => d.root === selectedChord.root && d.type === selectedChord.type,
        )
      : -1;

    const nextDegrees =
      currentDegree >= 0
        ? (PROGRESSION_MAP[currentDegree] ?? [])
        : [0, 3, 4, 5];

    // ── 1. Strongly suggested diatonic next (green) ───────────────────────────
    nextDegrees.forEach((deg) => {
      const d = diatonic[deg];
      if (!d) return;
      push({
        root: d.root,
        type: d.type,
        embellishments: [],
        label: chordLabel(d.root, d.type),
        color: DOT_COLORS.next,
        isNext: true,
      });
      // Add the natural 7th extension
      const emb = d.type === "Maj" ? "maj7" : d.type === "Min" ? "7" : null;
      if (emb) {
        push({
          root: d.root,
          type: d.type,
          embellishments: [emb],
          label: chordLabel(d.root, d.type, emb),
          color: DOT_COLORS.next,
          isNext: true,
        });
      }
    });

    // ── 2. Secondary dominants (gold) — V7/x chords ───────────────────────────
    // Prioritise the secondary doms that lead into the suggested next chords
    getSecondaryDominants(key, scale, nextDegrees).forEach(push);

    // ── 3. Borrowed chords from parallel mode (violet) ────────────────────────
    getBorrowedChords(key, scale).forEach(push);

    // ── 4. Tritone substitution of the dominant (orange) ─────────────────────
    // SubV7 = chord a tritone (6 semitones) above the V root
    const domIdx = (keyIdx + 7) % 12;
    const tritoneRoot = CHROMATIC_NOTES[(domIdx + 6) % 12];
    push({
      root: tritoneRoot,
      type: "Maj",
      embellishments: ["7"],
      label: chordLabel(tritoneRoot, "Maj", "7"),
      color: DOT_COLORS.tritone,
      isNext: false,
    });

    // ── 5. Remaining diatonic chords (slate) ─────────────────────────────────
    diatonic.forEach((d, idx) => {
      if (nextDegrees.includes(idx)) return; // already added
      push({
        root: d.root,
        type: d.type,
        embellishments: [],
        label: chordLabel(d.root, d.type),
        color: DOT_COLORS.diatonic,
        isNext: false,
      });
      const emb = d.type === "Maj" ? "maj7" : d.type === "Min" ? "7" : null;
      if (emb) {
        push({
          root: d.root,
          type: d.type,
          embellishments: [emb],
          label: chordLabel(d.root, d.type, emb),
          color: DOT_COLORS.diatonic,
          isNext: false,
        });
      }
    });

    return results;
  }, [key, scale, selectedChordId, timeline]);

  const play = useCallback(
    (idx: number) => {
      const s = suggestions[idx];
      if (!s) return;
      beginAudioInit();
      playChord(
        getChordNotes(s.root, s.type, s.embellishments, 0, octave),
        "1n",
      );
    },
    [suggestions, octave],
  );

  const handleDotClick = useCallback(
    (idx: number) => {
      setActiveIdx(idx);
      play(idx);
      const s = suggestions[idx];
      if (s) setPreviewChord({ root: s.root, type: s.type, embellishments: s.embellishments });
    },
    [play, suggestions, setPreviewChord],
  );

  const handleFirst = () => {
    setActiveIdx(0);
    play(0);
    const s = suggestions[0];
    if (s) setPreviewChord({ root: s.root, type: s.type, embellishments: s.embellishments });
  };

  const handlePrev = () =>
    setActiveIdx((i) => {
      const next = i === null ? suggestions.length - 1 : Math.max(0, i - 1);
      play(next);
      const s = suggestions[next];
      if (s) setPreviewChord({ root: s.root, type: s.type, embellishments: s.embellishments });
      return next;
    });

  const handleNext = () =>
    setActiveIdx((i) => {
      const next = i === null ? 0 : Math.min(suggestions.length - 1, i + 1);
      play(next);
      const s = suggestions[next];
      if (s) setPreviewChord({ root: s.root, type: s.type, embellishments: s.embellishments });
      return next;
    });

  const handleAdd = () => {
    if (activeIdx === null) return;
    const s = suggestions[activeIdx];
    if (!s) return;
    addChord({
      id: Math.random().toString(36).slice(2, 9),
      root: s.root,
      type: s.type,
      embellishments: s.embellishments,
      inversion: 0,
      octave,
    });
  };

  const active = activeIdx !== null ? suggestions[activeIdx] : null;

  return (
    <div className="csb">
      {/* Left controls */}
      <div className="csb-left">
        <span className="csb-label">Suggestions</span>
        <button className="csb-btn" onClick={handleFirst} title="First">
          ⏮
        </button>
        <button className="csb-btn" onClick={handlePrev} title="Previous">
          ◀
        </button>
        <button className="csb-btn" onClick={handleNext} title="Next">
          ▶
        </button>
      </div>

      {/* Dot track */}
      <div className="csb-track">
        {suggestions.map((s, i) => (
          <button
            key={`${s.root}-${s.type}-${s.embellishments[0] ?? "plain"}`}
            className={[
              "csb-dot",
              s.isNext ? "csb-dot--next" : "",
              activeIdx === i ? "csb-dot--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ "--dot-color": s.color } as React.CSSProperties}
            onClick={() => handleDotClick(i)}
            title={s.label}
          >
            <span className="csb-dot-label">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Right controls */}
      <div className="csb-right">
        <span className="csb-active-label">{active?.label ?? "\u00a0"}</span>
        <button
          className="csb-btn csb-btn--add"
          onClick={handleAdd}
          disabled={activeIdx === null}
          title="Add to timeline"
        >
          +
        </button>
      </div>
    </div>
  );
}
