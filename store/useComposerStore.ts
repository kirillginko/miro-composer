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

export interface ChordItem {
  id: string;
  root: string;
  type: ChordType;
  embellishments: string[];
  inversion: number;
  octave: number;
  strum: boolean;
  strumSpeed: "slow" | "medium" | "fast";
  strumDirection: "up" | "down";
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

  setKey: (key: string) => void;
  setScale: (scale: string) => void;
  setShowChordMap: (v: boolean) => void;
  setBpm: (bpm: number) => void;
  addChord: (chord: ChordItem) => void;
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
    strum: false,
    strumSpeed: "medium",
    strumDirection: "up",
  };
}

const DEFAULT_CHORD: ChordItem = {
  id: makeId(),
  root: "C",
  type: "Maj",
  embellishments: [],
  inversion: 0,
  octave: 4,
  strum: false,
  strumSpeed: "medium",
  strumDirection: "up",
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
  showChordMap: false,

  setShowChordMap: (v) => set({ showChordMap: v }),

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
    // Inherit strum settings from the last chord so you don't have to re-enable for every chord
    const lastChord = timeline[timeline.length - 1];
    if (lastChord) {
      item.strum = lastChord.strum;
      item.strumSpeed = lastChord.strumSpeed;
      item.strumDirection = lastChord.strumDirection;
    }
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
    const { key, scale, timeline } = get();
    const diatonic = getDiatonicChords(key, scale);
    const lastChord = timeline[timeline.length - 1];

    const items: ChordItem[] = degrees.map((d) => {
      const dc = diatonic[d.degreeIndex] ?? diatonic[0];
      return {
        id: makeId(),
        root: dc.root,
        type: d.typeOverride ?? dc.type,
        embellishments: [],
        inversion: 0,
        octave: 4,
        strum: lastChord?.strum ?? false,
        strumSpeed: lastChord?.strumSpeed ?? "medium",
        strumDirection: lastChord?.strumDirection ?? "up",
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
