"use client";

import { useComposerStore, selectSelectedChord } from "@/store/useComposerStore";
import { getChordNotes } from "@/lib/musicTheory";
import { noteOn, noteOff } from "@/lib/audioEngine";

const MIDI_COLOR = "#2dd4bf"; // teal — distinct from the per-root chord colors

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

const OCTAVES = [2, 3, 4, 5, 6];
const WW = 32; // white key width
const WH = 80; // white key height
const BW = 20; // black key width
const BH = 50; // black key height

const WHITE_NOTES = ["C", "D", "E", "F", "G", "A", "B"];

// Position of each black key as a fraction of WW from the octave's left edge
const BLACK_DEFS = [
  { note: "C#", frac: 0.75 },
  { note: "D#", frac: 1.75 },
  { note: "F#", frac: 3.75 },
  { note: "G#", frac: 4.75 },
  { note: "A#", frac: 5.75 },
];

interface PKey {
  id: string;
  note: string;
  octave: number;
  x: number;
  isBlack: boolean;
}

function buildKeys(): PKey[] {
  const result: PKey[] = [];
  OCTAVES.forEach((oct, oi) => {
    const ox = oi * 7 * WW;
    WHITE_NOTES.forEach((note, ni) => {
      result.push({ id: `${note}${oct}`, note, octave: oct, x: ox + ni * WW, isBlack: false });
    });
    BLACK_DEFS.forEach(({ note, frac }) => {
      result.push({ id: `${note}${oct}`, note, octave: oct, x: ox + frac * WW - BW / 2, isBlack: true });
    });
  });
  return result;
}

const ALL_KEYS = buildKeys();
const TOTAL_W = OCTAVES.length * 7 * WW;

export default function PianoRoll() {
  const chord         = useComposerStore(selectSelectedChord);
  const midiNotes     = useComposerStore((s) => s.midiNotes);
  const midiConnected = useComposerStore((s) => s.midiConnected);
  const midiDevice    = useComposerStore((s) => s.midiDeviceName);

  const addMidiNote    = useComposerStore((s) => s.addMidiNote);
  const removeMidiNote = useComposerStore((s) => s.removeMidiNote);

  const chordActive = new Set(
    chord
      ? getChordNotes(chord.root, chord.type, chord.embellishments, chord.inversion, chord.octave)
      : []
  );
  const midiActive  = new Set(midiNotes);
  const chordColor  = chord ? (ROOT_COLORS[chord.root] ?? "#4a6fa5") : null;

  const whites = ALL_KEYS.filter((k) => !k.isBlack);
  const blacks = ALL_KEYS.filter((k) => k.isBlack);

  return (
    <div className="piano-roll">
      <div className="piano-roll__label">
        PIANO
        {midiConnected && (
          <span className="piano-roll__midi-badge" title={midiDevice ?? "MIDI device connected"}>
            MIDI
          </span>
        )}
      </div>
      <div className="piano-roll__scroll">
        <svg
          width="100%"
          height={WH}
          viewBox={`0 0 ${TOTAL_W} ${WH}`}
          preserveAspectRatio="none"
          style={{ display: "block" }}
        >
          {/* White keys */}
          {whites.map((k) => {
            const onChord = chordActive.has(k.id);
            const onMidi  = midiActive.has(k.id);
            const on      = onChord || onMidi;
            const fill    = onChord && chordColor ? chordColor : onMidi ? MIDI_COLOR : "#d8d8d8";
            return (
              <g key={k.id}>
                <rect
                  x={k.x + 1}
                  y={0}
                  width={WW - 2}
                  height={WH}
                  rx={4}
                  fill={fill}
                  stroke="#000"
                  strokeWidth={1}
                  style={{ cursor: "pointer" }}
                  onPointerDown={() => { addMidiNote(k.id); void noteOn(k.id); }}
                  onPointerUp={() => { removeMidiNote(k.id); noteOff(k.id); }}
                  onPointerLeave={() => { removeMidiNote(k.id); noteOff(k.id); }}
                />
                <text
                  x={k.x + WW / 2}
                  y={WH - 8}
                  textAnchor="middle"
                  fontSize="9"
                  fill={on ? "#fff" : "#555"}
                  fontWeight={on ? "700" : "400"}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {k.note === "C" ? `C${k.octave}` : on ? k.note : ""}
                </text>
              </g>
            );
          })}

          {/* Black keys rendered on top */}
          {blacks.map((k) => {
            const onChord = chordActive.has(k.id);
            const onMidi  = midiActive.has(k.id);
            const on      = onChord || onMidi;
            const fill    = onChord && chordColor ? chordColor : onMidi ? MIDI_COLOR : "#111";
            return (
              <g key={k.id}>
                <rect
                  x={k.x}
                  y={0}
                  width={BW}
                  height={BH}
                  rx={3}
                  fill={fill}
                  stroke="#000"
                  strokeWidth={1}
                  style={{ cursor: "pointer" }}
                  onPointerDown={() => { addMidiNote(k.id); void noteOn(k.id); }}
                  onPointerUp={() => { removeMidiNote(k.id); noteOff(k.id); }}
                  onPointerLeave={() => { removeMidiNote(k.id); noteOff(k.id); }}
                />
                {on && (
                  <text
                    x={k.x + BW / 2}
                    y={BH - 7}
                    textAnchor="middle"
                    fontSize="8"
                    fill="#fff"
                    fontWeight="700"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {k.note.replace("#", "♯")}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
