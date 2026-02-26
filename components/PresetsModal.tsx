"use client";

import { useState } from "react";
import { useComposerStore } from "@/store/useComposerStore";
import {
  CHORD_PRESETS,
  PRESET_CATEGORIES,
  type ChordPreset,
  type PresetCategory,
} from "@/lib/presets";
import { FLAT_NAMES } from "@/lib/musicTheory";

interface Props {
  onClose: () => void;
}

export default function PresetsModal({ onClose }: Props) {
  const [activeCategory, setActiveCategory] = useState<PresetCategory>("All");
  const loadPreset = useComposerStore((s) => s.loadPreset);
  const key = useComposerStore((s) => s.key);
  const scale = useComposerStore((s) => s.scale);

  const filtered =
    activeCategory === "All"
      ? CHORD_PRESETS
      : CHORD_PRESETS.filter((p) => p.category === activeCategory);

  function handleSelect(preset: ChordPreset) {
    loadPreset(preset.degrees);
    onClose();
  }

  const displayKey = FLAT_NAMES[key] ?? key;

  const scaleLabel =
    scale === "major" ? "Major"
    : scale === "naturalMinor" ? "Minor"
    : scale.charAt(0).toUpperCase() + scale.slice(1);

  return (
    <div className="presets-overlay" onClick={onClose}>
      <div className="presets-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="presets-modal__header">
          <div>
            <div className="presets-modal__title">Chord Presets</div>
            <div className="presets-modal__subtitle">
              Key of {displayKey} {scaleLabel} — click any preset to load into timeline
            </div>
          </div>
          <button className="presets-modal__close" onClick={onClose} title="Close">
            ×
          </button>
        </div>

        {/* Category filter */}
        <div className="presets-modal__categories">
          {PRESET_CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`presets-category-btn ${activeCategory === cat ? "presets-category-btn--active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="presets-modal__grid">
          {filtered.map((preset) => (
            <div
              key={preset.id}
              className="preset-card"
              onClick={() => handleSelect(preset)}
            >
              <div className="preset-card__category">{preset.category}</div>
              <div className="preset-card__name">{preset.name}</div>
              <div className="preset-card__desc">{preset.description}</div>
              <div className="preset-card__labels">
                {preset.romanLabels.map((label, i) => (
                  <span key={i} className="preset-card__roman">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
