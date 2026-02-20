// ─── Note data ───────────────────────────────────────────────────────────────

export const CHROMATIC_NOTES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

// Enharmonic display names (prefer flats for display in some contexts)
export const FLAT_NAMES: Record<string, string> = {
  "C#": "Db",
  "D#": "Eb",
  "F#": "Gb",
  "G#": "Ab",
  "A#": "Bb",
};

export const NOTE_TO_INDEX: Record<string, number> = {};
CHROMATIC_NOTES.forEach((n, i) => {
  NOTE_TO_INDEX[n] = i;
});
// Also map flat names
Object.entries(FLAT_NAMES).forEach(([sharp, flat]) => {
  NOTE_TO_INDEX[flat] = NOTE_TO_INDEX[sharp];
});

export function normalizeNote(note: string): string {
  if (NOTE_TO_INDEX[note] !== undefined) return note;
  return note;
}

// ─── Scale patterns (intervals in semitones) ─────────────────────────────────

export const SCALE_PATTERNS: Record<string, number[]> = {
  major: [2, 2, 1, 2, 2, 2, 1],
  naturalMinor: [2, 1, 2, 2, 1, 2, 2],
  harmonicMinor: [2, 1, 2, 2, 1, 3, 1],
  melodicMinor: [2, 1, 2, 2, 2, 2, 1],
  dorian: [2, 1, 2, 2, 2, 1, 2],
  phrygian: [1, 2, 2, 2, 1, 2, 2],
  lydian: [2, 2, 2, 1, 2, 2, 1],
  mixolydian: [2, 2, 1, 2, 2, 1, 2],
};

export const SCALE_LABELS: Record<string, string> = {
  major: "Major",
  naturalMinor: "Natural Minor",
  harmonicMinor: "Harmonic Minor",
  melodicMinor: "Melodic Minor",
  dorian: "Dorian",
  phrygian: "Phrygian",
  lydian: "Lydian",
  mixolydian: "Mixolydian",
};

// ─── Chord types ─────────────────────────────────────────────────────────────

export type ChordType = "Maj" | "Min" | "Aug" | "Dim" | "Sus2" | "Sus4";

export const CHORD_INTERVALS: Record<ChordType, number[]> = {
  Maj: [0, 4, 7],
  Min: [0, 3, 7],
  Aug: [0, 4, 8],
  Dim: [0, 3, 6],
  Sus2: [0, 2, 7],
  Sus4: [0, 5, 7],
};

// ─── Embellishments ───────────────────────────────────────────────────────────

export const EMBELLISHMENT_INTERVALS: Record<string, number> = {
  "7": 11,
  b7: 10,
  "9": 14,
  b9: 13,
  "11": 17,
  "#11": 18,
  "13": 21,
  "13b": 20,
};

// ─── Diatonic chord qualities per scale degree ────────────────────────────────

// For each scale, what chord type naturally occurs on each degree
const DIATONIC_QUALITIES: Record<string, ChordType[]> = {
  major: ["Maj", "Min", "Min", "Maj", "Maj", "Min", "Dim"],
  naturalMinor: ["Min", "Dim", "Maj", "Min", "Min", "Maj", "Maj"],
  harmonicMinor: ["Min", "Dim", "Aug", "Min", "Maj", "Maj", "Dim"],
  melodicMinor: ["Min", "Min", "Aug", "Maj", "Maj", "Dim", "Dim"],
  dorian: ["Min", "Min", "Maj", "Maj", "Min", "Dim", "Maj"],
  phrygian: ["Min", "Maj", "Maj", "Min", "Dim", "Maj", "Min"],
  lydian: ["Maj", "Maj", "Min", "Dim", "Maj", "Min", "Min"],
  mixolydian: ["Maj", "Min", "Dim", "Maj", "Min", "Min", "Maj"],
};

// ─── Core functions ───────────────────────────────────────────────────────────

export function getScaleNotes(root: string, scaleName: string): string[] {
  const rootIdx = NOTE_TO_INDEX[root];
  if (rootIdx === undefined) return [];
  const pattern = SCALE_PATTERNS[scaleName];
  if (!pattern) return [];

  const notes: string[] = [root];
  let current = rootIdx;
  for (const interval of pattern.slice(0, -1)) {
    current = (current + interval) % 12;
    notes.push(CHROMATIC_NOTES[current]);
  }
  return notes;
}

export interface ChordDef {
  root: string;
  type: ChordType;
  degree: number; // 1-7
}

export function getDiatonicChords(root: string, scaleName: string): ChordDef[] {
  const scaleNotes = getScaleNotes(root, scaleName);
  const qualities = DIATONIC_QUALITIES[scaleName] || DIATONIC_QUALITIES.major;
  return scaleNotes.map((note, i) => ({
    root: note,
    type: qualities[i],
    degree: i + 1,
  }));
}

export function getChordNotes(
  root: string,
  type: ChordType,
  embellishments: string[] = [],
  inversion: number = 0,
  octave: number = 4
): string[] {
  const rootIdx = NOTE_TO_INDEX[root];
  if (rootIdx === undefined) return [];

  const baseIntervals = CHORD_INTERVALS[type] ?? [0, 4, 7];
  const embIntervals = embellishments
    .map((e) => EMBELLISHMENT_INTERVALS[e])
    .filter((v) => v !== undefined);

  const allIntervals = [...baseIntervals, ...embIntervals].sort((a, b) => a - b);

  const notes: string[] = allIntervals.map((interval) => {
    const noteIdx = (rootIdx + interval) % 12;
    const noteOctave = octave + Math.floor((rootIdx + interval) / 12);
    return `${CHROMATIC_NOTES[noteIdx]}${noteOctave}`;
  });

  // Apply inversion: move bottom notes up an octave
  const clamped = Math.min(inversion, notes.length - 1);
  for (let i = 0; i < clamped; i++) {
    const note = notes.shift()!;
    const letter = note.replace(/\d/, "");
    const oct = parseInt(note.match(/\d+$/)?.[0] ?? "4");
    notes.push(`${letter}${oct + 1}`);
  }

  return notes;
}

export function getChordName(
  root: string,
  type: ChordType,
  embellishments: string[] = [],
  inversion: number = 0
): string {
  const typeSuffix: Record<ChordType, string> = {
    Maj: "",
    Min: "m",
    Aug: "aug",
    Dim: "dim",
    Sus2: "sus2",
    Sus4: "sus4",
  };

  let name = root + typeSuffix[type];
  if (embellishments.length > 0) {
    name += embellishments.join("");
  }
  if (inversion > 0) {
    const invSuffix = ["", "/1st", "/2nd", "/3rd", "/4th"][inversion] ?? "";
    name += invSuffix;
  }
  return name;
}

// ─── Circle of Fifths ─────────────────────────────────────────────────────────

export interface CircleKey {
  major: string;
  minor: string;
  angle: number; // degrees, 0 = top (C)
}

// Circle of fifths order: C G D A E B F#/Gb Db Ab Eb Bb F
const CIRCLE_MAJOR = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"];
const CIRCLE_MINOR = ["Am", "Em", "Bm", "F#m", "C#m", "G#m", "D#m", "Bbm", "Fm", "Cm", "Gm", "Dm"];

export function getCircleOfFifthsKeys(): CircleKey[] {
  return CIRCLE_MAJOR.map((major, i) => ({
    major,
    minor: CIRCLE_MINOR[i],
    angle: i * 30, // 360 / 12 = 30 degrees per segment
  }));
}

// ─── Chord suggestion ─────────────────────────────────────────────────────────

export function suggestNextChord(
  usedChords: ChordDef[],
  key: string,
  scale: string
): ChordDef {
  const diatonic = getDiatonicChords(key, scale);

  if (usedChords.length === 0) {
    // Start with tonic
    return diatonic[0];
  }

  const lastChord = usedChords[usedChords.length - 1];
  const lastDegree = diatonic.findIndex((c) => c.root === lastChord.root);

  // Common progressions: follow circle of diatonic function
  // Tonic (1) → Subdominant (4) or Dominant (5)
  // Subdominant (4) → Dominant (5) or Tonic (1)
  // Dominant (5) → Tonic (1)
  const progressionMap: Record<number, number[]> = {
    0: [3, 4, 5], // I → IV, V, vi
    1: [4, 0],    // ii → V, I
    2: [3, 5],    // iii → IV, vi
    3: [4, 0, 1], // IV → V, I, ii
    4: [0, 5],    // V → I, vi
    5: [3, 1],    // vi → IV, ii
    6: [0],       // vii° → I
  };

  const nextDegrees = progressionMap[lastDegree >= 0 ? lastDegree : 0] ?? [0, 3, 4];
  const nextDegree = nextDegrees[Math.floor(Math.random() * nextDegrees.length)];
  return diatonic[nextDegree] ?? diatonic[0];
}
