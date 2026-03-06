"use client";

import { useComposerStore } from "@/store/useComposerStore";
import { getChordName, getChordNotes, ChordType } from "@/lib/musicTheory";
import { playChord } from "@/lib/audioEngine";

interface ModalDef {
  label: string;
  type: ChordType;
  embellishments: string[];
  desc: string;
}

// Each entry is the tonic chord quality for that mode, all built on the current key root.
// Lydian gets #11 (raised 4th), Mixolydian gets dominant 7th — these are what make each
// mode sonically distinct from plain Maj/Min.
const MODAL_DEFS: ModalDef[] = [
  { label: "Ionian",     type: "Maj", embellishments: [],      desc: "Standard major"       },
  { label: "Dorian",     type: "Min", embellishments: [],      desc: "Minor + natural 6th"  },
  { label: "Phrygian",   type: "Min", embellishments: [],      desc: "Minor + flat 2nd"     },
  { label: "Lydian",     type: "Maj", embellishments: ["#11"], desc: "Major + raised 4th"   },
  { label: "Mixolydian", type: "Maj", embellishments: ["7"],   desc: "Major + flat 7th"     },
  { label: "Aeolian",    type: "Min", embellishments: [],      desc: "Natural minor"        },
  { label: "Locrian",    type: "Dim", embellishments: [],      desc: "Diminished tonic"     },
];

const ROOT_COLORS: Record<string, string> = {
  C: "#4a6fa5", "C#": "#5a4fa5", D: "#6a4fa5", "D#": "#7a4f9a",
  E: "#4f7aa5", F: "#4f9aa5", "F#": "#4fa58a", G: "#4fa55a",
  "G#": "#6aa54f", A: "#a5854f", "A#": "#a55a4f", B: "#a54f6a",
};

const TYPE_COLORS: Partial<Record<ChordType, string>> = {
  Maj: "#6a9fd8",
  Min: "#9b8ec4",
  Dim: "#4a5568",
};

export default function ModalChords() {
  const key = useComposerStore((s) => s.key);

  const dotColor = ROOT_COLORS[key] ?? "#4a6fa5";

  function handleDragStart(
    e: React.DragEvent,
    type: ChordType,
    embellishments: string[]
  ) {
    e.dataTransfer.setData(
      "application/chord-def",
      JSON.stringify({ root: key, type, embellishments })
    );
    e.dataTransfer.effectAllowed = "copy";
  }

  function handleMouseEnter(e: React.MouseEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    el.style.background  = "#1a1a1a";
    el.style.borderColor = "#4a6fa5";
  }

  function handleMouseLeave(e: React.MouseEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    el.style.background  = "#111";
    el.style.borderColor = "#222";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", minWidth: "148px" }}>

      <div className="section-label">Modes</div>

      {MODAL_DEFS.map((mod) => {
        const chordName  = getChordName(key, mod.type, mod.embellishments, 0);
        const labelColor = TYPE_COLORS[mod.type] ?? "#6a9fd8";

        return (
          <div
            key={mod.label}
            draggable
            onDragStart={(e) => handleDragStart(e, mod.type, mod.embellishments)}
            onClick={() =>
              playChord(getChordNotes(key, mod.type, mod.embellishments, 0, 4))
            }
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            title={`${mod.label} — ${mod.desc} · Click to preview · Drag to timeline`}
            style={{
              display:      "flex",
              alignItems:   "center",
              gap:          "0.5rem",
              padding:      "0.45rem 0.75rem",
              background:   "#111",
              border:       "1.5px solid #222",
              borderRadius: "8px",
              cursor:       "grab",
              userSelect:   "none",
            }}
          >
            {/* Root color dot */}
            <div style={{
              width: 7, height: 7,
              borderRadius: "50%",
              background: dotColor,
              flexShrink: 0,
            }} />

            {/* Mode label */}
            <span style={{
              fontSize:      "0.62rem",
              fontWeight:    700,
              fontStyle:     "italic",
              color:         labelColor,
              minWidth:      "2.8rem",
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
        fontSize:      "0.58rem",
        color:         "#4a5568",
        marginTop:     "0.1rem",
        letterSpacing: "0.02em",
      }}>
        click to preview · drag to timeline
      </p>
    </div>
  );
}
