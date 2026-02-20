import { create } from "zustand";
import {
  ChordType,
  getDiatonicChords,
  suggestNextChord,
  type ChordDef,
} from "@/lib/musicTheory";

export interface ChordItem {
  id: string;
  root: string;
  type: ChordType;
  embellishments: string[];
  inversion: number;
}

interface ComposerState {
  key: string;
  scale: string;
  bpm: number;
  timeline: ChordItem[];
  selectedChordId: string | null;

  setKey: (key: string) => void;
  setScale: (scale: string) => void;
  setBpm: (bpm: number) => void;
  addChord: (chord: ChordItem) => void;
  removeChord: (id: string) => void;
  updateChord: (id: string, updates: Partial<ChordItem>) => void;
  reorderTimeline: (activeId: string, overId: string) => void;
  selectChord: (id: string | null) => void;
  duplicateChord: (id: string) => void;
  generateChord: () => ChordItem;
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
  };
}

export const useComposerStore = create<ComposerState>((set, get) => ({
  key: "C",
  scale: "major",
  bpm: 80,
  timeline: [],
  selectedChordId: null,

  setKey: (key) => set({ key }),
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
    set((state) => ({
      timeline: [...state.timeline, item],
      selectedChordId: item.id,
    }));
    return item;
  },
}));

// Selector helpers
export const selectSelectedChord = (state: ComposerState) =>
  state.selectedChordId
    ? state.timeline.find((c) => c.id === state.selectedChordId) ?? null
    : null;

export const selectDiatonicChords = (state: ComposerState) =>
  getDiatonicChords(state.key, state.scale);
