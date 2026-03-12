"use client";

import { useMemo, useState, useCallback } from "react";
import { useComposerStore } from "@/store/useComposerStore";
import {
  getDiatonicChords,
  getChordNotes,
  FLAT_NAMES,
  type ChordType,
} from "@/lib/musicTheory";
import { playChord, beginAudioInit } from "@/lib/audioEngine";

const TYPE_SUFFIX: Record<ChordType, string> = {
  Maj: "", Min: "m", Dim: "dim", Aug: "aug", Sus2: "sus2", Sus4: "sus4",
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

// Best embellishment per chord type for suggestions
const EMB_FOR_TYPE: Partial<Record<ChordType, string>> = {
  Maj: "maj7",
  Min: "7",
};

const DOT_COLORS = {
  next:        "#4ade80",  // green  — suggested next (plain)
  nextEmb:     "#38bdf8",  // blue   — suggested next (embellished)
  diatonic:    "#94a3b8",  // slate  — other diatonic
  diatonicEmb: "#4a5568",  // dimmer — other diatonic embellished
};

interface Suggestion {
  root: string;
  type: ChordType;
  embellishments: string[];
  label: string;
  color: string;
  isNext: boolean;
}

export function ChordSuggestionBar() {
  const key            = useComposerStore((s) => s.key);
  const scale          = useComposerStore((s) => s.scale);
  const octave         = useComposerStore((s) => s.octave);
  const timeline       = useComposerStore((s) => s.timeline);
  const selectedChordId = useComposerStore((s) => s.selectedChordId);
  const addChord       = useComposerStore((s) => s.addChord);

  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const suggestions = useMemo<Suggestion[]>(() => {
    const diatonic = getDiatonicChords(key, scale);

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
        : [0, 3, 4];

    const results: Suggestion[] = [];

    // 1. Suggested next — plain then embellished
    nextDegrees.forEach((deg) => {
      const d = diatonic[deg];
      if (!d) return;
      const displayRoot = FLAT_NAMES[d.root] ?? d.root;
      results.push({
        root: d.root, type: d.type, embellishments: [],
        label: `${displayRoot}${TYPE_SUFFIX[d.type]}`,
        color: DOT_COLORS.next, isNext: true,
      });
      const emb = EMB_FOR_TYPE[d.type];
      if (emb) {
        results.push({
          root: d.root, type: d.type, embellishments: [emb],
          label: `${displayRoot}${TYPE_SUFFIX[d.type]}${emb}`,
          color: DOT_COLORS.nextEmb, isNext: true,
        });
      }
    });

    // 2. Remaining diatonic — plain then embellished
    diatonic.forEach((d, idx) => {
      if (nextDegrees.includes(idx)) return;
      const displayRoot = FLAT_NAMES[d.root] ?? d.root;
      results.push({
        root: d.root, type: d.type, embellishments: [],
        label: `${displayRoot}${TYPE_SUFFIX[d.type]}`,
        color: DOT_COLORS.diatonic, isNext: false,
      });
      const emb = EMB_FOR_TYPE[d.type];
      if (emb) {
        results.push({
          root: d.root, type: d.type, embellishments: [emb],
          label: `${displayRoot}${TYPE_SUFFIX[d.type]}${emb}`,
          color: DOT_COLORS.diatonicEmb, isNext: false,
        });
      }
    });

    return results;
  }, [key, scale, selectedChordId, timeline]);

  // Reset active when key/scale changes
  const play = useCallback(
    (idx: number) => {
      const s = suggestions[idx];
      if (!s) return;
      beginAudioInit();
      playChord(getChordNotes(s.root, s.type, s.embellishments, 0, octave), "1n");
    },
    [suggestions, octave],
  );

  const handleDotClick = useCallback(
    (idx: number) => { setActiveIdx(idx); play(idx); },
    [play],
  );

  const handleFirst = () => { setActiveIdx(0); play(0); };

  const handlePrev = () =>
    setActiveIdx((i) => {
      const next = i === null ? suggestions.length - 1 : Math.max(0, i - 1);
      play(next);
      return next;
    });

  const handleNext = () =>
    setActiveIdx((i) => {
      const next = i === null ? 0 : Math.min(suggestions.length - 1, i + 1);
      play(next);
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
        <span className="csb-label">Next</span>
        <button className="csb-btn" onClick={handleFirst} title="First">⏮</button>
        <button className="csb-btn" onClick={handlePrev} title="Previous">◀</button>
        <button className="csb-btn" onClick={handleNext} title="Next">▶</button>
        <div
          className={`csb-cursor${active ? " csb-cursor--active" : ""}`}
          style={active ? { background: active.color, boxShadow: `0 0 7px ${active.color}` } : {}}
        />
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
            ].filter(Boolean).join(" ")}
            style={{ "--dot-color": s.color } as React.CSSProperties}
            onClick={() => handleDotClick(i)}
            title={s.label}
          />
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
