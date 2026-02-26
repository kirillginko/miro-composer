"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useComposerStore, ChordItem } from "@/store/useComposerStore";
import { getChordName, getChordNotes, getDiatonicChords, NOTE_TO_INDEX, ChordType } from "@/lib/musicTheory";
import { playChord, strumChord } from "@/lib/audioEngine";

const ROOT_COLORS: Record<string, string> = {
  C: "#4a6fa5", "C#": "#5a4fa5", D: "#6a4fa5", "D#": "#7a4f9a",
  E: "#4f7aa5", F: "#4f9aa5", "F#": "#4fa58a", G: "#4fa55a",
  "G#": "#6aa54f", A: "#a5854f", "A#": "#a55a4f", B: "#a54f6a",
};

function getColor(root: string): string {
  return ROOT_COLORS[root] ?? "#4a6fa5";
}

// Return the Roman numeral degree and whether the root is diatonic to the key
function getDegreeInfo(
  chordRoot: string,
  chordType: ChordType,
  key: string,
  scale: string
): { label: string; inKey: boolean } {
  const diatonic = getDiatonicChords(key, scale);
  const rootIdx = NOTE_TO_INDEX[chordRoot] ?? -1;
  if (rootIdx === -1) return { label: "?", inKey: false };

  const match = diatonic.find((c) => (NOTE_TO_INDEX[c.root] ?? -1) === rootIdx);

  if (match) {
    return { label: formatDegree(match.degree, chordType), inKey: true };
  }

  // Not diatonic — find nearest diatonic note (1 semitone up → ♭X, down → ♯X)
  const upIdx = (rootIdx + 1) % 12;
  const upMatch = diatonic.find((c) => (NOTE_TO_INDEX[c.root] ?? -1) === upIdx);
  if (upMatch) {
    return { label: "♭" + formatDegree(upMatch.degree, chordType), inKey: false };
  }

  const downIdx = (rootIdx + 11) % 12;
  const downMatch = diatonic.find((c) => (NOTE_TO_INDEX[c.root] ?? -1) === downIdx);
  if (downMatch) {
    return { label: "♯" + formatDegree(downMatch.degree, chordType), inKey: false };
  }

  return { label: "?", inKey: false };
}

function formatDegree(degree: number, type: ChordType): string {
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII"][degree - 1] ?? "?";
  if (type === "Min") return roman.toLowerCase();
  if (type === "Dim") return roman.toLowerCase() + "°";
  if (type === "Aug") return roman + "+";
  return roman; // Maj, Sus2, Sus4
}

interface Props {
  chord: ChordItem;
  isSelected: boolean;
  isCurrentlyPlaying?: boolean;
}

export default function ChordCard({ chord, isSelected, isCurrentlyPlaying = false }: Props) {
  // Explicit per-field selectors so the card re-renders whenever key or scale changes
  const key        = useComposerStore((s) => s.key);
  const scale      = useComposerStore((s) => s.scale);
  const selectChord = useComposerStore((s) => s.selectChord);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: chord.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const name = getChordName(chord.root, chord.type, chord.embellishments, chord.inversion);
  const color = getColor(chord.root);
  const degreeInfo = getDegreeInfo(chord.root, chord.type, key, scale);

  async function handleCardClick() {
    selectChord(chord.id);
    const notes = getChordNotes(chord.root, chord.type, chord.embellishments, chord.inversion, chord.octave);
    if (chord.strum) {
      await strumChord(notes, "2n", chord.strumSpeed, chord.strumDirection);
    } else {
      await playChord(notes);
    }
  }

  const borderColor = isCurrentlyPlaying ? color : isSelected ? color : "transparent";

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderColor }}
      className={`chord-card group ${isSelected ? "chord-card--selected" : ""} ${isCurrentlyPlaying ? "chord-card--playing" : ""}`}
      onClick={handleCardClick}
    >
      {/* Drag handle */}
      <div {...attributes} {...listeners} className="drag-handle" title="Drag to reorder">
        <GripIcon />
      </div>

      {/* Color dot */}
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />

      {/* Name + degree label */}
      <div className="chord-card__info">
        <span className="chord-card__name">{name}</span>
        <span
          className="chord-card__degree"
          style={{ color: degreeInfo.inKey ? "var(--accent-light)" : "var(--text-dim)" }}
        >
          {degreeInfo.label}
        </span>
      </div>

    </div>
  );
}

function GripIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="opacity-40">
      <circle cx="4" cy="3" r="1" /><circle cx="8" cy="3" r="1" />
      <circle cx="4" cy="6" r="1" /><circle cx="8" cy="6" r="1" />
      <circle cx="4" cy="9" r="1" /><circle cx="8" cy="9" r="1" />
    </svg>
  );
}
