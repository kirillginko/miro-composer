import { create } from "zustand";
import {
  ChordType,
  getDiatonicChords,
  suggestNextChord,
  NOTE_TO_INDEX,
  CHROMATIC_NOTES,
  type ChordDef,
} from "@/lib/musicTheory";
import { type PresetDegree } from "@/lib/presets";

export type NoteDuration = "4n" | "8n" | "8t" | "16n";

export interface ChordItem {
  id: string;
  root: string;
  type: ChordType;
  embellishments: string[];
  inversion: number;
  octave: number;
  /** True = silent rest for this beat slot */
  isRest?: boolean;
  /** Note duration for this slot — default quarter note */
  duration?: NoteDuration;
}

interface ComposerState {
  key: string;
  scale: string;
  bpm: number;
  timeline: ChordItem[];
  selectedChordId: string | null;
  midiNotes: string[];
  midiConnected: boolean;
  midiDeviceName: string | null;
  showChordMap: boolean;
  showTimeline: boolean;
  showPianoRoll: boolean;
  showChordEditor: boolean;
  strum: boolean;
  strumSpeed: "slow" | "medium" | "fast";
  strumDirection: "up" | "down";
  octave: number;

  setKey: (key: string) => void;
  setScale: (scale: string) => void;
  setShowChordMap: (v: boolean) => void;
  setShowTimeline: (v: boolean) => void;
  setShowPianoRoll: (v: boolean) => void;
  setShowChordEditor: (v: boolean) => void;
  setBpm: (bpm: number) => void;
  setStrum: (v: boolean) => void;
  setStrumSpeed: (v: "slow" | "medium" | "fast") => void;
  setStrumDirection: (v: "up" | "down") => void;
  setOctave: (v: number) => void;
  addChord: (chord: ChordItem) => void;
  addRest: () => void;
  removeChord: (id: string) => void;
  updateChord: (id: string, updates: Partial<ChordItem>) => void;
  reorderTimeline: (activeId: string, overId: string) => void;
  selectChord: (id: string | null) => void;
  duplicateChord: (id: string) => void;
  generateChord: () => ChordItem;
  loadPreset: (degrees: PresetDegree[]) => void;
  addMidiNote: (note: string) => void;
  removeMidiNote: (note: string) => void;
  setMidiStatus: (connected: boolean, deviceName: string | null) => void;
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function chordDefToItem(def: ChordDef): ChordItem {
  return {
    id: makeId(),
    root: def.root,
    type: def.type,
    embellishments: [],
    inversion: 0,
    octave: 4,
  };
}

const DEFAULT_CHORD: ChordItem = {
  id: makeId(),
  root: "C",
  type: "Maj",
  embellishments: [],
  inversion: 0,
  octave: 4,
};

export const useComposerStore = create<ComposerState>((set, get) => ({
  key: "C",
  scale: "major",
  bpm: 80,
  timeline: [DEFAULT_CHORD],
  selectedChordId: DEFAULT_CHORD.id,
  midiNotes: [],
  midiConnected: false,
  midiDeviceName: null,
  showChordMap: true,
  showTimeline: false,
  showPianoRoll: false,
  showChordEditor: false,
  strum: false,
  strumSpeed: "medium",
  strumDirection: "up",
  octave: 4,

  setShowChordMap: (v) => set({ showChordMap: v }),
  setShowTimeline: (v) => set({ showTimeline: v }),
  setShowPianoRoll: (v) => set({ showPianoRoll: v }),
  setShowChordEditor: (v) => set({ showChordEditor: v }),
  setStrum: (v) => set({ strum: v }),
  setStrumSpeed: (v) => set({ strumSpeed: v }),
  setStrumDirection: (v) => set({ strumDirection: v }),
  setOctave: (v) => set({ octave: v }),

  setKey: (newKey) => {
    const { key: oldKey, timeline } = get();
    if (timeline.length === 0) { set({ key: newKey }); return; }

    const oldIdx   = NOTE_TO_INDEX[oldKey] ?? 0;
    const newIdx   = NOTE_TO_INDEX[newKey] ?? 0;
    const semitones = (newIdx - oldIdx + 12) % 12;

    if (semitones === 0) { set({ key: newKey }); return; }

    const transposed = timeline.map((chord) => {
      const rootIdx    = NOTE_TO_INDEX[chord.root] ?? 0;
      const newRootIdx = (rootIdx + semitones) % 12;
      return { ...chord, root: CHROMATIC_NOTES[newRootIdx] };
    });

    set({ key: newKey, timeline: transposed });
  },
  setScale: (scale) => set({ scale }),
  setBpm: (bpm) => set({ bpm }),

  addChord: (chord) =>
    set((state) => ({ timeline: [...state.timeline, chord] })),

  addRest: () =>
    set((state) => ({
      timeline: [
        ...state.timeline,
        { id: makeId(), root: "C", type: "Maj", embellishments: [], inversion: 0, octave: 4, isRest: true },
      ],
    })),

  removeChord: (id) =>
    set((state) => {
      const next = state.timeline.filter((c) => c.id !== id);
      let selectedChordId = state.selectedChordId;
      if (selectedChordId === id) {
        // Pick the chord that was right after, or the new last one, or null
        const idx = state.timeline.findIndex((c) => c.id === id);
        selectedChordId = (next[idx] ?? next[idx - 1] ?? null)?.id ?? null;
      }
      return { timeline: next, selectedChordId };
    }),

  updateChord: (id, updates) =>
    set((state) => ({
      timeline: state.timeline.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),

  reorderTimeline: (activeId, overId) =>
    set((state) => {
      const items = [...state.timeline];
      const oldIndex = items.findIndex((c) => c.id === activeId);
      const newIndex = items.findIndex((c) => c.id === overId);
      if (oldIndex === -1 || newIndex === -1) return {};
      const [moved] = items.splice(oldIndex, 1);
      items.splice(newIndex, 0, moved);
      return { timeline: items };
    }),

  selectChord: (id) => set({ selectedChordId: id }),

  duplicateChord: (id) =>
    set((state) => {
      const chord = state.timeline.find((c) => c.id === id);
      if (!chord) return {};
      const copy: ChordItem = { ...chord, id: makeId() };
      const idx = state.timeline.findIndex((c) => c.id === id);
      const next = [...state.timeline];
      next.splice(idx + 1, 0, copy);
      return { timeline: next, selectedChordId: copy.id };
    }),

  generateChord: () => {
    const { key, scale, timeline } = get();
    const usedDefs: ChordDef[] = timeline.map((c) => ({
      root: c.root,
      type: c.type,
      degree: 1,
    }));
    const suggestion = suggestNextChord(usedDefs, key, scale);
    const item = chordDefToItem(suggestion);
    set((state) => ({
      timeline: [...state.timeline, item],
      selectedChordId: item.id,
    }));
    return item;
  },
  addMidiNote: (note) =>
    set((state) => ({
      midiNotes: state.midiNotes.includes(note)
        ? state.midiNotes
        : [...state.midiNotes, note],
    })),

  removeMidiNote: (note) =>
    set((state) => ({ midiNotes: state.midiNotes.filter((n) => n !== note) })),

  setMidiStatus: (connected, deviceName) =>
    set({ midiConnected: connected, midiDeviceName: deviceName }),

  loadPreset: (degrees) => {
    const { key, scale } = get();
    const diatonic = getDiatonicChords(key, scale);

    const items: ChordItem[] = degrees.map((d) => {
      const dc = diatonic[d.degreeIndex] ?? diatonic[0];
      return {
        id: makeId(),
        root: dc.root,
        type: d.typeOverride ?? dc.type,
        embellishments: [],
        inversion: 0,
        octave: 4,
      };
    });

    set({ timeline: items, selectedChordId: items[0]?.id ?? null });
  },
}));

// Selector helpers
export const selectSelectedChord = (state: ComposerState) =>
  state.selectedChordId
    ? state.timeline.find((c) => c.id === state.selectedChordId) ?? null
    : null;

export const selectDiatonicChords = (state: ComposerState) =>
  getDiatonicChords(state.key, state.scale);
