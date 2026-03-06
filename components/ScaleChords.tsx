"use client";

import { useComposerStore } from "@/store/useComposerStore";
import { getDiatonicChords, getChordName, getChordNotes, ChordType } from "@/lib/musicTheory";
import { playChord } from "@/lib/audioEngine";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

function formatRoman(index: number, type: ChordType): string {
  const r = ROMAN[index] ?? "?";
  if (type === "Min") return r.toLowerCase();
  if (type === "Dim") return r.toLowerCase() + "°";
  if (type === "Aug") return r + "+";
  return r;
}

// Same root-color map as ChordCard
const ROOT_COLORS: Record<string, string> = {
  C: "#4a6fa5", "C#": "#5a4fa5", D: "#6a4fa5", "D#": "#7a4f9a",
  E: "#4f7aa5", F: "#4f9aa5", "F#": "#4fa58a", G: "#4fa55a",
  "G#": "#6aa54f", A: "#a5854f", "A#": "#a55a4f", B: "#a54f6a",
};

const DEGREE_COLORS: Partial<Record<ChordType, string>> = {
  Maj:  "#6a9fd8",
  Min:  "#9b8ec4",
  Dim:  "#4a5568",
  Aug:  "#b8a060",
  Sus2: "#6a9fd8",
  Sus4: "#6a9fd8",
};

export default function ScaleChords() {
  const key   = useComposerStore((s) => s.key);
  const scale = useComposerStore((s) => s.scale);

  const diatonic = getDiatonicChords(key, scale);

  function handleDragStart(e: React.DragEvent, root: string, type: ChordType) {
    e.dataTransfer.setData(
      "application/chord-def",
      JSON.stringify({ root, type })
    );
    e.dataTransfer.effectAllowed = "copy";
  }

  function handleMouseEnter(e: React.MouseEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    el.style.background = "#1a1a1a";
    el.style.borderColor = "#4a6fa5";
  }

  function handleMouseLeave(e: React.MouseEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    el.style.background = "#111";
    el.style.borderColor = "#222";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", minWidth: "148px" }}>

      {/* Title — same style as section labels in ChordEditor */}
      <div className="section-label">Scale Chords</div>

      {/* Chord buttons */}
      {diatonic.map((chord, i) => {
        const name        = getChordName(chord.root, chord.type, [], 0);
        const roman       = formatRoman(i, chord.type);
        const dotColor    = ROOT_COLORS[chord.root] ?? "#4a6fa5";
        const romanColor  = DEGREE_COLORS[chord.type] ?? "#6a9fd8";

        return (
          <div
            key={i}
            draggable
            onDragStart={(e) => handleDragStart(e, chord.root, chord.type)}
            onClick={() => {
              playChord(getChordNotes(chord.root, chord.type, [], 0, 4));
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            title="Click to add · Drag to timeline"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.45rem 0.75rem",
              background: "#111",
              border: "1.5px solid #222",
              borderRadius: "8px",
              cursor: "grab",
              userSelect: "none",
            }}
          >
            {/* Root color dot */}
            <div style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: dotColor,
              flexShrink: 0,
            }} />

            {/* Roman numeral */}
            <span style={{
              fontSize: "0.62rem",
              fontWeight: 700,
              fontStyle: "italic",
              color: romanColor,
              minWidth: "1.6rem",
              letterSpacing: "0.03em",
            }}>
              {roman}
            </span>

            {/* Chord name */}
            <span style={{
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#e2e8f0",
            }}>
              {name}
            </span>
          </div>
        );
      })}

      <p style={{
        fontSize: "0.58rem",
        color: "#4a5568",
        marginTop: "0.1rem",
        letterSpacing: "0.02em",
      }}>
        click to add · drag to timeline
      </p>
    </div>
  );
}
