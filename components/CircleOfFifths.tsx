"use client";

import { useComposerStore, selectSelectedChord } from "@/store/useComposerStore";
import { getCircleOfFifthsKeys, getChordNotes, getChordName, getDiatonicChords, NOTE_TO_INDEX, CHROMATIC_NOTES } from "@/lib/musicTheory";
import { playChord } from "@/lib/audioEngine";

const CIRCLE_KEYS = getCircleOfFifthsKeys();
const SIZE = 380;
const CX = SIZE / 2;
const CY = SIZE / 2;
const OUTER_R = 160;
const INNER_R = 105;
const MINOR_R = 70;

function noteIdx(note: string): number {
  return NOTE_TO_INDEX[note] ?? -1;
}

function polarToXY(angleDeg: number, r: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function slicePath(
  startAngle: number,
  endAngle: number,
  innerR: number,
  outerR: number
): string {
  const s1 = polarToXY(startAngle, outerR);
  const e1 = polarToXY(endAngle, outerR);
  const s2 = polarToXY(endAngle, innerR);
  const e2 = polarToXY(startAngle, innerR);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${s1.x} ${s1.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${e1.x} ${e1.y}`,
    `L ${s2.x} ${s2.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${e2.x} ${e2.y}`,
    "Z",
  ].join(" ");
}

function getDegreeLabel(degree: number, type: string): string {
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII"][degree - 1] ?? "";
  if (type === "Min") return roman.toLowerCase();
  if (type === "Dim") return roman.toLowerCase() + "°";
  if (type === "Aug") return roman + "+";
  return roman;
}

export default function CircleOfFifths() {
  const key         = useComposerStore((s) => s.key);
  const scale       = useComposerStore((s) => s.scale);
  const setKey      = useComposerStore((s) => s.setKey);
  const updateChord = useComposerStore((s) => s.updateChord);
  const selectedChord = useComposerStore(selectSelectedChord);
  const diatonicChords = getDiatonicChords(key, scale);

  // Index diatonic chords by semitone for enharmonic-safe lookups
  const diatonicMap = new Map<number, { degree: number; type: string }>();
  diatonicChords.forEach((c, i) => {
    const idx = noteIdx(c.root);
    if (idx !== -1) diatonicMap.set(idx, { degree: i + 1, type: c.type });
  });

  const keyIdx = noteIdx(key);
  const selectedRootIdx = selectedChord ? noteIdx(selectedChord.root) : -1;

  const selectedChordLabel = selectedChord
    ? getChordName(selectedChord.root, selectedChord.type, [], 0)
    : null;

  // Convert any note name (including flats like "Db") to the internal sharp form ("C#")
  function toInternalNote(note: string): string {
    const idx = noteIdx(note);
    return idx !== -1 ? CHROMATIC_NOTES[idx] : note;
  }

  async function handleMajorClick(majorKey: string) {
    const internalRoot = toInternalNote(majorKey);
    if (selectedChord) {
      // Update root and force type to Maj
      updateChord(selectedChord.id, { root: internalRoot, type: "Maj" });
      const notes = getChordNotes(
        internalRoot,
        "Maj",
        selectedChord.embellishments,
        selectedChord.inversion,
        selectedChord.octave
      );
      await playChord(notes);
    } else {
      // No chord selected — treat click as key change
      setKey(majorKey);
      const notes = getChordNotes(internalRoot, "Maj", [], 0);
      await playChord(notes);
    }
  }

  async function handleMinorClick(minorLabel: string) {
    const internalRoot = toInternalNote(minorLabel.replace("m", ""));
    if (selectedChord) {
      // Update root and switch type to minor
      updateChord(selectedChord.id, { root: internalRoot, type: "Min" });
      const notes = getChordNotes(
        internalRoot,
        "Min",
        selectedChord.embellishments,
        selectedChord.inversion,
        selectedChord.octave
      );
      await playChord(notes);
    } else {
      const notes = getChordNotes(internalRoot, "Min", [], 0);
      await playChord(notes);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <h3 className="text-xs font-semibold tracking-widest opacity-50 uppercase">
        Circle of Fifths
      </h3>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="select-none"
      >
        <defs>
          <filter id="cof-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {CIRCLE_KEYS.map((ck, i) => {
          const startAngle = ck.angle - 15;
          const endAngle = ck.angle + 15;
          const midAngle = ck.angle;
          const ckIdx      = noteIdx(ck.major);
          const minorRootIdx = noteIdx(ck.minor.replace("m", ""));

          // Enharmonic-safe comparisons
          const isCurrentKey = ckIdx !== -1 && ckIdx === keyIdx;
          const diatonicInfo = diatonicMap.get(ckIdx);
          const isDiatonic = !!diatonicInfo;

          // Each ring compares against its own root index
          const selectedIsMinor   = selectedChord?.type === "Min";
          const isSelectedMajorRing = !selectedIsMinor && selectedRootIdx !== -1 && ckIdx === selectedRootIdx;
          const isSelectedMinorRing =  selectedIsMinor && selectedRootIdx !== -1 && minorRootIdx === selectedRootIdx;
          const isSelectedRoot = isSelectedMajorRing || isSelectedMinorRing;

          // Segment fill — priority: selected > key > diatonic quality > default
          let majorFill: string;
          let majorStroke: string;
          let strokeWidth: string;

          if (isSelectedMajorRing) {
            majorFill = isCurrentKey ? "#b87020" : "#6b3e08";
            majorStroke = "#f0a030";
            strokeWidth = "2";
          } else if (isCurrentKey) {
            majorFill = "#4a6fa5";
            majorStroke = "#6a9fd8";
            strokeWidth = "1.5";
          } else if (isDiatonic) {
            switch (diatonicInfo!.type) {
              case "Maj": majorFill = "#1c3452"; majorStroke = "#2a4868"; break;
              case "Min": majorFill = "#2b1d48"; majorStroke = "#3c2860"; break;
              case "Dim": majorFill = "#3a1822"; majorStroke = "#4e1e2e"; break;
              case "Aug": majorFill = "#1b3826"; majorStroke = "#284e36"; break;
              default:    majorFill = "#283850"; majorStroke = "#384860";
            }
            strokeWidth = "1";
          } else {
            majorFill = "#1e2535";
            majorStroke = "#2d3a50";
            strokeWidth = "1";
          }

          // Minor ring — highlight if selected minor chord or diatonic
          const isMinorDiatonic = diatonicMap.has(minorRootIdx);
          const minorFill = isSelectedMinorRing ? "#6b3e08"
            : isMinorDiatonic ? "#1e2e40"
            : "#171e2c";
          const minorStroke = isSelectedMinorRing ? "#f0a030" : "#1a2535";
          const minorStrokeWidth = isSelectedMinorRing ? "2" : "1";
          const minorTextFill = isSelectedMinorRing ? "#fff4c0"
            : isMinorDiatonic ? "#7a90b0"
            : "#364658";

          // Label positions
          const degreeLabelPos = polarToXY(midAngle, OUTER_R - 14); // near outer edge
          const noteNamePos = polarToXY(midAngle, INNER_R + 22);    // near inner edge of outer ring
          const noteNameCenterPos = polarToXY(midAngle, (OUTER_R + INNER_R) / 2); // centered (no degree)
          const minorLabelPos = polarToXY(midAngle, (INNER_R + MINOR_R) / 2);

          return (
            <g key={i}>
              {/* Glow halo — outer ring for major/other selection, inner ring for minor */}
              {isSelectedRoot && (
                <path
                  d={slicePath(
                    startAngle, endAngle,
                    isSelectedMinorRing ? MINOR_R : INNER_R,
                    isSelectedMinorRing ? INNER_R : OUTER_R
                  )}
                  fill="rgba(240, 160, 48, 0.08)"
                  stroke="rgba(240, 160, 48, 0.55)"
                  strokeWidth="2.5"
                  filter="url(#cof-glow)"
                  className="pointer-events-none"
                />
              )}

              {/* Major segment */}
              <path
                d={slicePath(startAngle, endAngle, INNER_R, OUTER_R)}
                fill={majorFill}
                stroke={majorStroke}
                strokeWidth={strokeWidth}
                className="cursor-pointer transition-all duration-150 hover:brightness-125"
                onClick={() => handleMajorClick(ck.major)}
              />

              {/* Roman numeral degree label — diatonic segments only */}
              {isDiatonic && diatonicInfo && (
                <text
                  x={degreeLabelPos.x}
                  y={degreeLabelPos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill={
                    isSelectedMajorRing ? "#f0c060"
                    : isCurrentKey      ? "#8ab4e8"
                    : "#5a789a"
                  }
                  className="pointer-events-none"
                >
                  {getDegreeLabel(diatonicInfo.degree, diatonicInfo.type)}
                </text>
              )}

              {/* Note name */}
              <text
                x={isDiatonic ? noteNamePos.x : noteNameCenterPos.x}
                y={isDiatonic ? noteNamePos.y : noteNameCenterPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="12"
                fontWeight={isSelectedRoot || isCurrentKey ? "700" : isDiatonic ? "600" : "400"}
                fill={
                  isSelectedRoot ? "#fff4c0"
                  : isCurrentKey  ? "#ffffff"
                  : isDiatonic    ? "#b0c4de"
                  : "#485870"
                }
                className="pointer-events-none"
              >
                {ck.major}
              </text>

              {/* Minor segment */}
              <path
                d={slicePath(startAngle, endAngle, MINOR_R, INNER_R)}
                fill={minorFill}
                stroke={minorStroke}
                strokeWidth={minorStrokeWidth}
                className="cursor-pointer transition-all duration-150 hover:brightness-125"
                onClick={() => handleMinorClick(ck.minor)}
              />
              <text
                x={minorLabelPos.x}
                y={minorLabelPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
                fill={minorTextFill}
                className="pointer-events-none"
              >
                {ck.minor}
              </text>
            </g>
          );
        })}

        {/* Center circle */}
        <circle
          cx={CX} cy={CY} r={MINOR_R - 2}
          fill="#0f1420" stroke="#1e2a3a" strokeWidth="1"
        />
        <text
          x={CX}
          y={CY - (selectedChordLabel ? 14 : 8)}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="22"
          fontWeight="700"
          fill="#e2e8f0"
        >
          {key}
        </text>
        <text
          x={CX}
          y={CY + (selectedChordLabel ? 2 : 10)}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="10"
          fill="#718096"
        >
          {scale === "major" ? "Major"
            : scale === "naturalMinor" ? "Minor"
            : scale}
        </text>
        {selectedChordLabel && (
          <text
            x={CX}
            y={CY + 20}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="11"
            fontWeight="600"
            fill="#e8a030"
          >
            {selectedChordLabel}
          </text>
        )}
      </svg>

      {/* Color legend */}
      <div className="flex items-center gap-3" style={{ fontSize: "0.65rem", opacity: 0.55 }}>
        <LegendDot color="#4a6fa5" label="Key" />
        <LegendDot color="#1c3452" label="Maj" />
        <LegendDot color="#2b1d48" label="min" />
        <LegendDot color="#3a1822" label="dim°" />
        <LegendDot color="#f0a030" label="Selected" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <span
        style={{
          display: "inline-block",
          width: 9,
          height: 9,
          borderRadius: 2,
          background: color,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}
