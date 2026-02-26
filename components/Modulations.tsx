"use client";

import { useComposerStore } from "@/store/useComposerStore";
import {
  CHROMATIC_NOTES,
  NOTE_TO_INDEX,
  getChordName,
  getChordNotes,
  ChordType,
} from "@/lib/musicTheory";
import { playChord } from "@/lib/audioEngine";

interface ModDef {
  label: string;   // Roman numeral label shown on the button
  semitones: number;
  type: ChordType;
  desc: string;    // tooltip / description
}

const MOD_DEFS: ModDef[] = [
  { label: "V/V",   semitones: 2,  type: "Maj", desc: "Secondary dominant → V"  },
  { label: "V/vi",  semitones: 4,  type: "Maj", desc: "Secondary dominant → vi" },
  { label: "V/ii",  semitones: 9,  type: "Maj", desc: "Secondary dominant → ii" },
  { label: "V/IV",  semitones: 7,  type: "Maj", desc: "Secondary dominant → IV" },
  { label: "iv",    semitones: 5,  type: "Min", desc: "Borrowed minor IV"        },
  { label: "♭III",  semitones: 3,  type: "Maj", desc: "Borrowed ♭III"            },
  { label: "♭VI",   semitones: 8,  type: "Maj", desc: "Borrowed ♭VI"             },
  { label: "♭VII",  semitones: 10, type: "Maj", desc: "Borrowed ♭VII"            },
  { label: "♭II",   semitones: 1,  type: "Maj", desc: "Neapolitan"               },
];

const ROOT_COLORS: Record<string, string> = {
  C: "#4a6fa5", "C#": "#5a4fa5", D: "#6a4fa5", "D#": "#7a4f9a",
  E: "#4f7aa5", F: "#4f9aa5", "F#": "#4fa58a", G: "#4fa55a",
  "G#": "#6aa54f", A: "#a5854f", "A#": "#a55a4f", B: "#a54f6a",
};

const TYPE_COLORS: Partial<Record<ChordType, string>> = {
  Maj:  "#6a9fd8",
  Min:  "#9b8ec4",
  Dim:  "#4a5568",
  Aug:  "#b8a060",
};

export default function Modulations() {
  const key = useComposerStore((s) => s.key);

  function getRoot(semitones: number): string {
    const keyIdx  = NOTE_TO_INDEX[key] ?? 0;
    const newIdx  = (keyIdx + semitones) % 12;
    return CHROMATIC_NOTES[newIdx];
  }

  function handleDragStart(e: React.DragEvent, root: string, type: ChordType) {
    e.dataTransfer.setData(
      "application/chord-def",
      JSON.stringify({ root, type })
    );
    e.dataTransfer.effectAllowed = "copy";
  }

  function handleMouseEnter(e: React.MouseEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    el.style.background  = "#253050";
    el.style.borderColor = "#4a6fa5";
  }

  function handleMouseLeave(e: React.MouseEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    el.style.background  = "#1e2840";
    el.style.borderColor = "#2a3555";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", minWidth: "148px" }}>

      <div className="section-label">Modulations</div>

      {MOD_DEFS.map((mod) => {
        const internalRoot = getRoot(mod.semitones);
        const chordName    = getChordName(internalRoot, mod.type, [], 0);
        const dotColor     = ROOT_COLORS[internalRoot] ?? "#4a6fa5";
        const labelColor   = TYPE_COLORS[mod.type] ?? "#6a9fd8";

        return (
          <div
            key={mod.label}
            draggable
            onDragStart={(e) => handleDragStart(e, internalRoot, mod.type)}
            onClick={() => playChord(getChordNotes(internalRoot, mod.type, [], 0, 4))}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            title={`${mod.desc} · Click to preview · Drag to timeline`}
            style={{
              display:    "flex",
              alignItems: "center",
              gap:        "0.5rem",
              padding:    "0.45rem 0.75rem",
              background: "#1e2840",
              border:     "1.5px solid #2a3555",
              borderRadius: "8px",
              cursor:     "grab",
              userSelect: "none",
            }}
          >
            {/* Root color dot */}
            <div style={{
              width: 7, height: 7,
              borderRadius: "50%",
              background: dotColor,
              flexShrink: 0,
            }} />

            {/* Arrow + degree label */}
            <span style={{
              fontSize:    "0.62rem",
              fontWeight:  700,
              fontStyle:   "italic",
              color:       labelColor,
              minWidth:    "2.2rem",
              letterSpacing: "0.03em",
            }}>
              {mod.label}
            </span>

            {/* Chord name */}
            <span style={{
              fontSize:   "0.85rem",
              fontWeight: 600,
              color:      "#e2e8f0",
            }}>
              {chordName}
            </span>
          </div>
        );
      })}

      <p style={{
        fontSize: "0.58rem",
        color:    "#4a5568",
        marginTop: "0.1rem",
        letterSpacing: "0.02em",
      }}>
        click to preview · drag to timeline
      </p>
    </div>
  );
}
