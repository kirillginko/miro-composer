"use client";

import { useComposerStore } from "@/store/useComposerStore";
import { SCALE_LABELS, CHROMATIC_NOTES, FLAT_NAMES } from "@/lib/musicTheory";

const KEY_OPTIONS = CHROMATIC_NOTES.map((n) => ({
  value: n,
  label: FLAT_NAMES[n] ?? n,
}));

const SCALE_OPTIONS = Object.entries(SCALE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export default function Toolbar() {
  const { key, scale, bpm, setKey, setScale, setBpm, generateChord } = useComposerStore();

  return (
    <header className="toolbar">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <span className="text-xl">♪</span>
        <span className="font-bold text-sm tracking-wide text-white">Music Composer</span>
      </div>

      {/* Key selector */}
      <div className="flex items-center gap-2">
        <label className="toolbar-label">Key</label>
        <select
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="toolbar-select"
        >
          {KEY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Scale selector */}
      <div className="flex items-center gap-2">
        <label className="toolbar-label">Scale</label>
        <select
          value={scale}
          onChange={(e) => setScale(e.target.value)}
          className="toolbar-select"
        >
          {SCALE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* BPM control */}
      <div className="flex items-center gap-2">
        <label className="toolbar-label">BPM</label>
        <input
          type="number"
          min={40}
          max={240}
          value={bpm}
          onChange={(e) => setBpm(Math.min(240, Math.max(40, Number(e.target.value))))}
          className="toolbar-bpm"
        />
      </div>

      {/* Generate button */}
      <button onClick={() => generateChord()} className="generate-btn--toolbar">
        <span className="text-blue-300">✦</span> Generate Chord
      </button>
    </header>
  );
}
