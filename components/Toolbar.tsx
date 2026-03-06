"use client";

import { useState, useRef, useEffect } from "react";
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
  const showChordMap = useComposerStore((s) => s.showChordMap);
  const setShowChordMap = useComposerStore((s) => s.setShowChordMap);
  const showTimeline = useComposerStore((s) => s.showTimeline);
  const setShowTimeline = useComposerStore((s) => s.setShowTimeline);
  const showPianoRoll = useComposerStore((s) => s.showPianoRoll);
  const setShowPianoRoll = useComposerStore((s) => s.setShowPianoRoll);
  const showChordEditor = useComposerStore((s) => s.showChordEditor);
  const setShowChordEditor = useComposerStore((s) => s.setShowChordEditor);
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
        <BpmControl bpm={bpm} setBpm={setBpm} />
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
      {/* <button onClick={() => generateChord()} className="generate-btn--toolbar">
        <span className="text-blue-300">✦</span> Generate
      </button> */}

      {/* Timeline toggle */}
      <button
        onClick={() => setShowTimeline(!showTimeline)}
        className={`panel-toggle-btn${showTimeline ? " panel-toggle-btn--active" : ""}`}
        title={showTimeline ? "Hide Timeline" : "Show Timeline"}
      >
        <TimelineIcon />
      </button>

      {/* Piano Roll toggle */}
      <button
        onClick={() => setShowPianoRoll(!showPianoRoll)}
        className={`panel-toggle-btn${showPianoRoll ? " panel-toggle-btn--active" : ""}`}
        title={showPianoRoll ? "Hide Piano Roll" : "Show Piano Roll"}
      >
        <PianoRollIcon />
      </button>

      {/* Chord Editor toggle */}
      <button
        onClick={() => setShowChordEditor(!showChordEditor)}
        className={`panel-toggle-btn${showChordEditor ? " panel-toggle-btn--active" : ""}`}
        title={showChordEditor ? "Hide Chord Editor" : "Show Chord Editor"}
      >
        <ChordEditorIcon />
      </button>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Chord Map / Circle of Fifths toggle */}
      <button
        onClick={() => setShowChordMap(!showChordMap)}
        className={`chord-map-btn--toolbar${showChordMap ? " chord-map-btn--active" : ""}`}
      >
        {showChordMap ? "◎ Chord Map" : "◎ Circle of Fifths"}
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

function BpmControl({ bpm, setBpm }: { bpm: number; setBpm: (v: number) => void }) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(String(bpm));
  const wrapRef = useRef<HTMLDivElement>(null);

  // Keep input in sync when store changes externally
  useEffect(() => { setInputVal(String(bpm)); }, [bpm]);

  // Close popover when clicking outside
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function commitInput(val: string) {
    const n = parseInt(val, 10);
    if (!isNaN(n)) {
      const clamped = Math.min(240, Math.max(40, n));
      setBpm(clamped);
      setInputVal(String(clamped));
    } else {
      setInputVal(String(bpm));
    }
  }

  return (
    <div ref={wrapRef} className="bpm-control">
      <input
        className="bpm-input"
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={(e) => commitInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { commitInput(inputVal); (e.target as HTMLInputElement).blur(); }
          if (e.key === "Escape") { setInputVal(String(bpm)); (e.target as HTMLInputElement).blur(); setOpen(false); }
        }}
        size={3}
      />
      {open && (
        <div className="bpm-popover">
          <input
            type="range"
            min={40}
            max={240}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="bpm-slider"
          />
          <span className="bpm-popover-value">{bpm} BPM</span>
        </div>
      )}
    </div>
  );
}

function ChordEditorIcon() {
  // A chord symbol: stacked horizontal lines with a bracket (like a chord sheet)
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="8" y1="9" x2="16" y2="9" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="15" x2="13" y2="15" />
    </svg>
  );
}

function TimelineIcon() {
  // DAW-style arrangement view: staggered horizontal clips on tracks
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="2" y="3" width="12" height="4" rx="1" />
      <rect x="2" y="10" width="7" height="4" rx="1" />
      <rect x="11" y="10" width="11" height="4" rx="1" />
      <rect x="2" y="17" width="16" height="4" rx="1" />
    </svg>
  );
}

function PianoRollIcon() {
  // Front-view piano keyboard: 3 white keys, 2 black keys (C-D-E pattern)
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="2"  y="3" width="6" height="18" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9"  y="3" width="6" height="18" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="16" y="3" width="6" height="18" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="6"  y="3" width="4" height="11" rx="0.5" fill="currentColor" />
      <rect x="13" y="3" width="4" height="11" rx="0.5" fill="currentColor" />
    </svg>
  );
}
