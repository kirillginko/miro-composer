"use client";

import { memo } from "react";
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
  return roman;
}

interface Props {
  chord: ChordItem;
  isSelected: boolean;
  isCurrentlyPlaying?: boolean;
}

const ChordCard = memo(function ChordCard({ chord, isSelected, isCurrentlyPlaying = false }: Props) {
  // Only subscribe to values that affect rendering
  const key   = useComposerStore((s) => s.key);
  const scale = useComposerStore((s) => s.scale);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: chord.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const name       = getChordName(chord.root, chord.type, chord.embellishments, chord.inversion);
  const color      = getColor(chord.root);
  const degreeInfo = getDegreeInfo(chord.root, chord.type, key, scale);

  async function handleCardClick() {
    // Read strum settings at click time — no subscription needed
    const { selectChord, strum, strumSpeed, strumDirection } = useComposerStore.getState();
    selectChord(chord.id);
    const notes = getChordNotes(chord.root, chord.type, chord.embellishments, chord.inversion, chord.octave);
    if (strum) {
      await strumChord(notes, "2n", strumSpeed, strumDirection);
    } else {
      await playChord(notes);
    }
  }

  // ── Rest slot ──────────────────────────────────────────────────────────────
  if (chord.isRest) {
    return (
      <div
        ref={setNodeRef}
        style={{ ...style, opacity: isDragging ? 0.5 : 1 }}
        className={`chord-card chord-card--rest${isSelected ? " chord-card--rest-selected" : ""}${isCurrentlyPlaying ? " chord-card--playing" : ""}`}
        onClick={() => useComposerStore.getState().selectChord(chord.id)}
        {...attributes}
        {...listeners}
      >
        <span className="chord-card__rest-symbol" aria-label="rest">
          <span className="rest-bar rest-bar--top" />
          <span className="rest-bar rest-bar--mid" />
          <span className="rest-bar rest-bar--bot" />
        </span>
      </div>
    );
  }

  // ── Chord slot ─────────────────────────────────────────────────────────────
  const cardStyle = {
    ...style,
    borderColor: isCurrentlyPlaying ? color : isSelected ? color + "bb" : color + "44",
    background: isCurrentlyPlaying
      ? color + "55"
      : isSelected
      ? color + "22"
      : "rgba(8, 14, 26, 0.92)",
    boxShadow: isCurrentlyPlaying
      ? `0 0 18px ${color}99, inset 0 0 10px ${color}33`
      : isSelected
      ? `0 0 10px ${color}55`
      : "none",
  };

  return (
    <div
      ref={setNodeRef}
      style={cardStyle}
      className={`chord-card group ${isSelected ? "chord-card--selected" : ""} ${isCurrentlyPlaying ? "chord-card--playing" : ""}`}
      onClick={handleCardClick}
      {...attributes}
      {...listeners}
    >
      <span className="chord-card__name">{name}</span>
      <span className="chord-card__degree">{degreeInfo.label}</span>
    </div>
  );
});

export default ChordCard;
