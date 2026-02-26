"use client";

import { useState } from "react";
import { useComposerStore } from "@/store/useComposerStore";
import { SCALE_LABELS, CHROMATIC_NOTES, FLAT_NAMES } from "@/lib/musicTheory";
import { setVoice, type VoiceType } from "@/lib/audioEngine";
import PresetsModal from "@/components/PresetsModal";

const KEY_OPTIONS = CHROMATIC_NOTES.map((n) => ({
  value: n,
  label: FLAT_NAMES[n] ?? n,
}));

const SCALE_OPTIONS = Object.entries(SCALE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export default function Toolbar() {
  const key = useComposerStore((s) => s.key);
  const scale = useComposerStore((s) => s.scale);
  const bpm = useComposerStore((s) => s.bpm);
  const setKey = useComposerStore((s) => s.setKey);
  const setScale = useComposerStore((s) => s.setScale);
  const setBpm = useComposerStore((s) => s.setBpm);
  const generateChord = useComposerStore((s) => s.generateChord);
  const [voice, setVoiceState] = useState<VoiceType>("synth");
  const [presetsOpen, setPresetsOpen] = useState(false);

  function handleVoiceChange(v: VoiceType) {
    setVoiceState(v);
    setVoice(v);
  }

  return (
    <header className="toolbar">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <span className="text-xl">♪</span>
        <span className="font-bold text-sm tracking-wide text-white">
          Miro Arranger
        </span>
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
          onChange={(e) =>
            setBpm(Math.min(240, Math.max(40, Number(e.target.value))))
          }
          className="toolbar-bpm"
        />
      </div>

      {/* Voice selector */}
      <div className="flex items-center gap-2">
        <label className="toolbar-label">Voice</label>
        <select
          value={voice}
          onChange={(e) => handleVoiceChange(e.target.value as VoiceType)}
          className="toolbar-select"
        >
          <option value="synth">Piano</option>
          <option value="piano">Rhodes</option>
          <option value="organ">Organ</option>
        </select>
      </div>

      {/* Generate chord button */}
      <button onClick={() => generateChord()} className="generate-btn--toolbar">
        <span className="text-blue-300">✦</span> Generate
      </button>

      {/* Presets button */}
      <button
        onClick={() => setPresetsOpen(true)}
        className="presets-btn--toolbar"
      >
        ☰ Presets
      </button>

      {presetsOpen && <PresetsModal onClose={() => setPresetsOpen(false)} />}
    </header>
  );
}
