"use client";

import { useComposerStore, selectSelectedChord } from "@/store/useComposerStore";
import {
  getChordName,
  getChordNotes,
  getDiatonicChords,
  CHROMATIC_NOTES,
  ChordType,
  CHORD_INTERVALS,
} from "@/lib/musicTheory";
import { playChord, strumChord } from "@/lib/audioEngine";

const CHROMATIC_TOP = ["Db", "Eb", null, "Gb", "Ab", "Bb"];
const CHROMATIC_BOTTOM = ["C", "D", "E", "F", "G", "A", "B"];
const CHORD_TYPES: ChordType[] = ["Maj", "Min", "Aug", "Dim", "Sus2", "Sus4"];
const ALL_EMBELLISHMENTS = ["7", "maj7", "9", "b9", "11", "#11", "13", "13b"];
const EMBELLISHMENTS_ROW1 = ["7", "maj7", "9", "11"];
const EMBELLISHMENTS_ROW2 = ["b9", "#11", "13", "13b"];
const INVERSIONS = ["Root", "1st", "2nd", "3rd", "4th"];
const OCTAVES = [2, 3, 4, 5, 6];

const FLAT_TO_SHARP: Record<string, string> = {
  Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#",
};

function toInternal(note: string): string {
  return FLAT_TO_SHARP[note] ?? note;
}

function rootMatches(noteDisplay: string, chordRoot: string): boolean {
  return toInternal(noteDisplay) === chordRoot || noteDisplay === chordRoot;
}


export default function ChordEditor() {
  const maybeChord     = useComposerStore(selectSelectedChord);
  const key            = useComposerStore((s) => s.key);
  const scale          = useComposerStore((s) => s.scale);
  const strum          = useComposerStore((s) => s.strum);
  const strumSpeed     = useComposerStore((s) => s.strumSpeed);
  const strumDirection = useComposerStore((s) => s.strumDirection);
  const setStrum          = useComposerStore((s) => s.setStrum);
  const setStrumSpeed     = useComposerStore((s) => s.setStrumSpeed);
  const setStrumDirection = useComposerStore((s) => s.setStrumDirection);
  const setOctave         = useComposerStore((s) => s.setOctave);
  const removeChord    = useComposerStore((s) => s.removeChord);
  const updateChord    = useComposerStore((s) => s.updateChord);
  const duplicateChord = useComposerStore((s) => s.duplicateChord);
  const generateChord  = useComposerStore((s) => s.generateChord);


  if (!maybeChord) {
    return (
      <div className="chord-editor flex items-center justify-center text-center p-8">
        <div>
          <div className="text-4xl mb-3 opacity-30">♪</div>
          <p className="text-sm opacity-50">
            Select a chord from the timeline
            <br />or generate one to start
          </p>
        </div>
      </div>
    );
  }

  const chord = maybeChord;
  const chordName = getChordName(chord.root, chord.type, chord.embellishments, chord.inversion);
  const maxInversions = CHORD_INTERVALS[chord.type].length - 1 + chord.embellishments.length;

  // ── Playback ────────────────────────────────────────────────────────────────

  async function triggerPlay(
    root: string,
    type: ChordType,
    embellishments: string[],
    inversion: number,
    octave: number
  ) {
    const notes = getChordNotes(root, type, embellishments, inversion, octave);
    if (strum) {
      await strumChord(notes, "2n", strumSpeed, strumDirection);
    } else {
      await playChord(notes);
    }
  }

  // ── Chord controls ──────────────────────────────────────────────────────────

  function handleRootChange(note: string) {
    const internal = toInternal(note);
    updateChord(chord.id, { root: internal });
    triggerPlay(internal, chord.type, chord.embellishments, chord.inversion, chord.octave);
  }

  function handleTypeChange(type: ChordType) {
    const newInversion = Math.min(chord.inversion, CHORD_INTERVALS[type].length - 1);
    updateChord(chord.id, { type, inversion: newInversion });
    triggerPlay(chord.root, type, chord.embellishments, newInversion, chord.octave);
  }

  function handleEmbellishmentToggle(emb: string) {
    const next = chord.embellishments.includes(emb)
      ? chord.embellishments.filter((e) => e !== emb)
      : [...chord.embellishments, emb];
    updateChord(chord.id, { embellishments: next });
    triggerPlay(chord.root, chord.type, next, chord.inversion, chord.octave);
  }

  function handleInversionChange(inv: number) {
    updateChord(chord.id, { inversion: inv });
    triggerPlay(chord.root, chord.type, chord.embellishments, inv, chord.octave);
  }

  function handleOctaveChange(oct: number) {
    updateChord(chord.id, { octave: oct });
    setOctave(oct);
    triggerPlay(chord.root, chord.type, chord.embellishments, chord.inversion, oct);
  }

  // ── Randomize voicing ───────────────────────────────────────────────────────

  function handleRandomizeVoicing() {
    const newRoot = CHROMATIC_NOTES[Math.floor(Math.random() * 12)];
    const newType = CHORD_TYPES[Math.floor(Math.random() * CHORD_TYPES.length)];
    const maxInv = CHORD_INTERVALS[newType].length - 1;
    const newInversion = Math.floor(Math.random() * (maxInv + 1));
    const newOctave = [3, 4, 5][Math.floor(Math.random() * 3)];
    const count = Math.floor(Math.random() * 3);
    const newEmbellishments = [...ALL_EMBELLISHMENTS]
      .sort(() => Math.random() - 0.5)
      .slice(0, count);

    updateChord(chord.id, {
      root: newRoot,
      type: newType,
      inversion: newInversion,
      octave: newOctave,
      embellishments: newEmbellishments,
    });

    triggerPlay(newRoot, newType, newEmbellishments, newInversion, newOctave);
  }

  return (
    <div className="chord-editor flex flex-col gap-4 overflow-y-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{chordName}</h2>
        <div className="flex gap-2">
          <button onClick={() => duplicateChord(chord.id)} title="Duplicate" className="icon-btn">
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
      <button onClick={() => generateChord()} className="generate-btn">
        <span className="text-blue-300">✦</span> Generate New Chord
      </button>

      {/* Chord root picker */}
      <section>
        <div className="section-label">CHORD</div>
        <div className="note-grid">
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

      {/* Octave */}
      <section>
        <div className="section-label">OCTAVE</div>
        <div className="flex gap-2 flex-wrap">
          {OCTAVES.map((oct) => (
            <button
              key={oct}
              onClick={() => handleOctaveChange(oct)}
              className={`inv-btn ${chord.octave === oct ? "inv-btn--active" : ""}`}
            >
              {oct}
            </button>
          ))}
        </div>
      </section>

      {/* ── Strum ──────────────────────────────────────────────────────────── */}
      <section>
        <div className="section-label">STRUM</div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* Enable toggle */}
          <button
            onClick={() => setStrum(!strum)}
            className={`type-btn ${strum ? "type-btn--active" : ""}`}
            style={{ minWidth: "3rem" }}
          >
            {strum ? "On" : "Off"}
          </button>

          {strum && (
            <>
              {/* Speed */}
              {(["slow", "medium", "fast"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStrumSpeed(s)}
                  className={`inv-btn ${strumSpeed === s ? "inv-btn--active" : ""}`}
                >
                  {s === "slow" ? "Slow" : s === "medium" ? "Med" : "Fast"}
                </button>
              ))}

              {/* Direction */}
              <button
                onClick={() => setStrumDirection(strumDirection === "up" ? "down" : "up")}
                className="inv-btn"
                title="Toggle strum direction"
              >
                {strumDirection === "up" ? "↑ Up" : "↓ Down"}
              </button>
            </>
          )}
        </div>
      </section>

      {/* ── Randomize Voicing ──────────────────────────────────────────────── */}
      <section>
        <button onClick={handleRandomizeVoicing} className="generate-btn">
          <DiceIcon /> Randomize
        </button>
      </section>

    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

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

function DiceIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="3" />
      <circle cx="8"  cy="8"  r="1.2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="8"  r="1.2" fill="currentColor" stroke="none" />
      <circle cx="8"  cy="16" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
