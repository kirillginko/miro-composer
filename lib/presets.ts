import { ChordType } from "./musicTheory";

export interface PresetDegree {
  degreeIndex: number;       // 0–6 → diatonic scale degree (0 = tonic)
  typeOverride?: ChordType;  // optional: force a specific chord quality
}

export interface ChordPreset {
  id: string;
  name: string;
  description: string;
  category: "Classic" | "Pop" | "Jazz" | "Blues" | "Rock";
  degrees: PresetDegree[];
  romanLabels: string[];     // pre-computed Roman numeral labels for display
}

export const CHORD_PRESETS: ChordPreset[] = [
  // ── Classic ──────────────────────────────────────────────────────────────
  {
    id: "i-iv-v-i",
    name: "I – IV – V – I",
    description: "Timeless resolution",
    category: "Classic",
    degrees: [
      { degreeIndex: 0 },
      { degreeIndex: 3 },
      { degreeIndex: 4 },
      { degreeIndex: 0 },
    ],
    romanLabels: ["I", "IV", "V", "I"],
  },
  {
    id: "i-vi-iv-v",
    name: "I – vi – IV – V",
    description: "50s doo-wop",
    category: "Classic",
    degrees: [
      { degreeIndex: 0 },
      { degreeIndex: 5 },
      { degreeIndex: 3 },
      { degreeIndex: 4 },
    ],
    romanLabels: ["I", "vi", "IV", "V"],
  },
  {
    id: "i-iv-vi-v",
    name: "I – IV – vi – V",
    description: "Ballad feel",
    category: "Classic",
    degrees: [
      { degreeIndex: 0 },
      { degreeIndex: 3 },
      { degreeIndex: 5 },
      { degreeIndex: 4 },
    ],
    romanLabels: ["I", "IV", "vi", "V"],
  },
  {
    id: "canon",
    name: "Canon",
    description: "Pachelbel Canon",
    category: "Classic",
    degrees: [
      { degreeIndex: 0 },
      { degreeIndex: 4 },
      { degreeIndex: 5 },
      { degreeIndex: 2 },
      { degreeIndex: 3 },
      { degreeIndex: 0 },
      { degreeIndex: 3 },
      { degreeIndex: 4 },
    ],
    romanLabels: ["I", "V", "vi", "iii", "IV", "I", "IV", "V"],
  },

  // ── Pop ──────────────────────────────────────────────────────────────────
  {
    id: "i-v-vi-iv",
    name: "I – V – vi – IV",
    description: "Axis of awesome",
    category: "Pop",
    degrees: [
      { degreeIndex: 0 },
      { degreeIndex: 4 },
      { degreeIndex: 5 },
      { degreeIndex: 3 },
    ],
    romanLabels: ["I", "V", "vi", "IV"],
  },
  {
    id: "vi-iv-i-v",
    name: "vi – IV – I – V",
    description: "Minor feel",
    category: "Pop",
    degrees: [
      { degreeIndex: 5 },
      { degreeIndex: 3 },
      { degreeIndex: 0 },
      { degreeIndex: 4 },
    ],
    romanLabels: ["vi", "IV", "I", "V"],
  },
  {
    id: "i-iii-iv-v",
    name: "I – iii – IV – V",
    description: "Rising energy",
    category: "Pop",
    degrees: [
      { degreeIndex: 0 },
      { degreeIndex: 2 },
      { degreeIndex: 3 },
      { degreeIndex: 4 },
    ],
    romanLabels: ["I", "iii", "IV", "V"],
  },
  {
    id: "i-ii-iv-i",
    name: "I – ii – IV – I",
    description: "Country/folk",
    category: "Pop",
    degrees: [
      { degreeIndex: 0 },
      { degreeIndex: 1 },
      { degreeIndex: 3 },
      { degreeIndex: 0 },
    ],
    romanLabels: ["I", "ii", "IV", "I"],
  },

  // ── Jazz ─────────────────────────────────────────────────────────────────
  {
    id: "ii-v-i",
    name: "ii – V – I",
    description: "Jazz staple",
    category: "Jazz",
    degrees: [
      { degreeIndex: 1 },
      { degreeIndex: 4 },
      { degreeIndex: 0 },
    ],
    romanLabels: ["ii", "V", "I"],
  },
  {
    id: "ii-v-i-vi",
    name: "ii – V – I – vi",
    description: "Jazz turnaround",
    category: "Jazz",
    degrees: [
      { degreeIndex: 1 },
      { degreeIndex: 4 },
      { degreeIndex: 0 },
      { degreeIndex: 5 },
    ],
    romanLabels: ["ii", "V", "I", "vi"],
  },
  {
    id: "iii-vi-ii-v",
    name: "iii – vi – ii – V",
    description: "Circle of fifths",
    category: "Jazz",
    degrees: [
      { degreeIndex: 2 },
      { degreeIndex: 5 },
      { degreeIndex: 1 },
      { degreeIndex: 4 },
    ],
    romanLabels: ["iii", "vi", "ii", "V"],
  },
  {
    id: "i-vi-ii-v",
    name: "I – vi – ii – V",
    description: "Rhythm changes A",
    category: "Jazz",
    degrees: [
      { degreeIndex: 0 },
      { degreeIndex: 5 },
      { degreeIndex: 1 },
      { degreeIndex: 4 },
    ],
    romanLabels: ["I", "vi", "ii", "V"],
  },

  // ── Blues ─────────────────────────────────────────────────────────────────
  {
    id: "12-bar-blues",
    name: "12-Bar Blues",
    description: "Classic blues form",
    category: "Blues",
    degrees: [
      { degreeIndex: 0 },
      { degreeIndex: 0 },
      { degreeIndex: 0 },
      { degreeIndex: 0 },
      { degreeIndex: 3 },
      { degreeIndex: 3 },
      { degreeIndex: 0 },
      { degreeIndex: 0 },
      { degreeIndex: 4 },
      { degreeIndex: 3 },
      { degreeIndex: 0 },
      { degreeIndex: 4 },
    ],
    romanLabels: ["I", "I", "I", "I", "IV", "IV", "I", "I", "V", "IV", "I", "V"],
  },
  {
    id: "8-bar-blues",
    name: "8-Bar Blues",
    description: "Shorter blues form",
    category: "Blues",
    degrees: [
      { degreeIndex: 0 },
      { degreeIndex: 4 },
      { degreeIndex: 3 },
      { degreeIndex: 0 },
      { degreeIndex: 0 },
      { degreeIndex: 4 },
      { degreeIndex: 0 },
      { degreeIndex: 4 },
    ],
    romanLabels: ["I", "V", "IV", "I", "I", "V", "I", "V"],
  },

  // ── Rock ──────────────────────────────────────────────────────────────────
  {
    id: "i-vii-vi-v",
    name: "I – VII – VI – V",
    description: "Classic rock descend",
    category: "Rock",
    degrees: [
      { degreeIndex: 0 },
      { degreeIndex: 6 },
      { degreeIndex: 5 },
      { degreeIndex: 4 },
    ],
    romanLabels: ["I", "VII", "VI", "V"],
  },
  {
    id: "i-iv-i-v",
    name: "I – IV – I – V",
    description: "Power rock",
    category: "Rock",
    degrees: [
      { degreeIndex: 0 },
      { degreeIndex: 3 },
      { degreeIndex: 0 },
      { degreeIndex: 4 },
    ],
    romanLabels: ["I", "IV", "I", "V"],
  },
];

export const PRESET_CATEGORIES = ["All", "Classic", "Pop", "Jazz", "Blues", "Rock"] as const;
export type PresetCategory = (typeof PRESET_CATEGORIES)[number];
