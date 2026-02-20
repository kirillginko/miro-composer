"use client";

import { useComposerStore, selectSelectedChord } from "@/store/useComposerStore";
import { getChordName, getChordNotes, ChordType, CHORD_INTERVALS } from "@/lib/musicTheory";
import { playChord } from "@/lib/audioEngine";

const CHROMATIC_TOP = ["Db", "Eb", null, "Gb", "Ab", "Bb"];
const CHROMATIC_BOTTOM = ["C", "D", "E", "F", "G", "A", "B"];
const CHORD_TYPES: ChordType[] = ["Maj", "Min", "Aug", "Dim", "Sus2", "Sus4"];
const EMBELLISHMENTS_ROW1 = ["7", "9", "11", "13"];
const EMBELLISHMENTS_ROW2 = ["b7", "b9", "#11", "13b"];
const INVERSIONS = ["Root", "1st", "2nd", "3rd", "4th"];

// Map flat display names to internal sharp names
const FLAT_TO_SHARP: Record<string, string> = {
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
};

function toInternal(note: string): string {
  return FLAT_TO_SHARP[note] ?? note;
}

function rootMatches(noteDisplay: string, chordRoot: string): boolean {
  return toInternal(noteDisplay) === chordRoot || noteDisplay === chordRoot;
}

export default function ChordEditor() {
  const maybeChord = useComposerStore(selectSelectedChord);
  const { removeChord, updateChord, duplicateChord, generateChord } =
    useComposerStore();

  if (!maybeChord) {
    return (
      <div className="chord-editor flex items-center justify-center text-center p-8">
        <div>
          <div className="text-4xl mb-3 opacity-30">♪</div>
          <p className="text-sm opacity-50">Select a chord from the timeline<br />or generate one to start</p>
        </div>
      </div>
    );
  }

  // Reassign to a new const so TypeScript narrows the type in closures below
  const chord = maybeChord;

  const chordName = getChordName(chord.root, chord.type, chord.embellishments, chord.inversion);
  const maxInversions = CHORD_INTERVALS[chord.type].length - 1 + chord.embellishments.length;

  async function triggerPlay(
    root: string,
    type: ChordType,
    embellishments: string[],
    inversion: number
  ) {
    const notes = getChordNotes(root, type, embellishments, inversion);
    await playChord(notes);
  }

  function handleRootChange(note: string) {
    const internal = toInternal(note);
    updateChord(chord.id, { root: internal });
    triggerPlay(internal, chord.type, chord.embellishments, chord.inversion);
  }

  function handleTypeChange(type: ChordType) {
    const newInversion = Math.min(chord.inversion, CHORD_INTERVALS[type].length - 1);
    updateChord(chord.id, { type, inversion: newInversion });
    triggerPlay(chord.root, type, chord.embellishments, newInversion);
  }

  function handleEmbellishmentToggle(emb: string) {
    const next = chord.embellishments.includes(emb)
      ? chord.embellishments.filter((e) => e !== emb)
      : [...chord.embellishments, emb];
    updateChord(chord.id, { embellishments: next });
    triggerPlay(chord.root, chord.type, next, chord.inversion);
  }

  function handleInversionChange(inv: number) {
    updateChord(chord.id, { inversion: inv });
    triggerPlay(chord.root, chord.type, chord.embellishments, inv);
  }

  async function handleGenerate() {
    generateChord();
  }

  return (
    <div className="chord-editor flex flex-col gap-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{chordName}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => duplicateChord(chord.id)}
            title="Duplicate"
            className="icon-btn"
          >
            <CopyIcon />
          </button>
          <button
            onClick={() => removeChord(chord.id)}
            title="Delete"
            className="icon-btn text-red-400 hover:text-red-300"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* Generate button */}
      <button onClick={handleGenerate} className="generate-btn">
        <span className="text-blue-300">✦</span> Generate New Chord
      </button>

      {/* Chord root picker */}
      <section>
        <div className="section-label">CHORD</div>
        <div className="note-grid">
          {/* Top row: accidentals */}
          <div className="flex justify-center gap-2 mb-1">
            {CHROMATIC_TOP.map((note, i) =>
              note === null ? (
                <div key={i} className="w-10 h-10" />
              ) : (
                <button
                  key={note}
                  onClick={() => handleRootChange(note)}
                  className={`note-btn ${rootMatches(note, chord.root) ? "note-btn--active" : ""}`}
                >
                  {note}
                </button>
              )
            )}
          </div>
          {/* Bottom row: naturals */}
          <div className="flex justify-center gap-2">
            {CHROMATIC_BOTTOM.map((note) => (
              <button
                key={note}
                onClick={() => handleRootChange(note)}
                className={`note-btn ${rootMatches(note, chord.root) ? "note-btn--active" : ""}`}
              >
                {note}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Chord type */}
      <section>
        <div className="section-label">TYPE</div>
        <div className="flex gap-2 flex-wrap">
          {CHORD_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => handleTypeChange(t)}
              className={`type-btn ${chord.type === t ? "type-btn--active" : ""}`}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      {/* Embellishments */}
      <section>
        <div className="section-label">EMBELLISHMENTS</div>
        <div className="grid grid-cols-4 gap-2">
          {[...EMBELLISHMENTS_ROW1, ...EMBELLISHMENTS_ROW2].map((emb) => (
            <button
              key={emb}
              onClick={() => handleEmbellishmentToggle(emb)}
              className={`emb-btn ${chord.embellishments.includes(emb) ? "emb-btn--active" : ""}`}
            >
              {emb}
            </button>
          ))}
        </div>
      </section>

      {/* Inversion */}
      <section>
        <div className="section-label">INVERSION</div>
        <div className="flex gap-2 flex-wrap">
          {INVERSIONS.map((label, i) => {
            const disabled = i > maxInversions;
            return (
              <button
                key={label}
                disabled={disabled}
                onClick={() => handleInversionChange(i)}
                className={`inv-btn ${chord.inversion === i ? "inv-btn--active" : ""} ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
