"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useComposerStore } from "@/store/useComposerStore";
import { ChordItem } from "@/store/useComposerStore";
import { getChordName, getChordNotes } from "@/lib/musicTheory";
import { playChord } from "@/lib/audioEngine";

// Assign a deterministic color based on chord root
const ROOT_COLORS: Record<string, string> = {
  C: "#4a6fa5",
  "C#": "#5a4fa5",
  D: "#6a4fa5",
  "D#": "#7a4f9a",
  E: "#4f7aa5",
  F: "#4f9aa5",
  "F#": "#4fa58a",
  G: "#4fa55a",
  "G#": "#6aa54f",
  A: "#a5854f",
  "A#": "#a55a4f",
  B: "#a54f6a",
};

function getColor(root: string): string {
  return ROOT_COLORS[root] ?? "#4a6fa5";
}

interface Props {
  chord: ChordItem;
  isSelected: boolean;
  isCurrentlyPlaying?: boolean;
}

export default function ChordCard({ chord, isSelected, isCurrentlyPlaying = false }: Props) {
  const { selectChord, removeChord } = useComposerStore();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: chord.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const name = getChordName(chord.root, chord.type, chord.embellishments, chord.inversion);
  const color = getColor(chord.root);

  async function handlePlay(e: React.MouseEvent) {
    e.stopPropagation();
    const notes = getChordNotes(chord.root, chord.type, chord.embellishments, chord.inversion);
    await playChord(notes);
  }

  const borderColor = isCurrentlyPlaying ? color : isSelected ? color : "transparent";

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderColor }}
      className={`chord-card group ${isSelected ? "chord-card--selected" : ""} ${isCurrentlyPlaying ? "chord-card--playing" : ""}`}
      onClick={() => selectChord(chord.id)}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="drag-handle"
        title="Drag to reorder"
      >
        <GripIcon />
      </div>

      {/* Color dot */}
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />

      {/* Chord name */}
      <span className="chord-card__name">{name}</span>

      {/* Actions (show on hover) */}
      <div className="chord-card__actions">
        <button
          onClick={handlePlay}
          title="Play"
          className="card-action-btn"
        >
          <PlayIcon />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); removeChord(chord.id); }}
          title="Remove"
          className="card-action-btn text-red-400"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function GripIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="opacity-40">
      <circle cx="4" cy="3" r="1" />
      <circle cx="8" cy="3" r="1" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="8" cy="6" r="1" />
      <circle cx="4" cy="9" r="1" />
      <circle cx="8" cy="9" r="1" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}
