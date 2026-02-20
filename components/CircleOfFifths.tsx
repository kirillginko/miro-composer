"use client";

import { useComposerStore } from "@/store/useComposerStore";
import { getCircleOfFifthsKeys, getChordNotes, getDiatonicChords } from "@/lib/musicTheory";
import { playChord } from "@/lib/audioEngine";

const CIRCLE_KEYS = getCircleOfFifthsKeys();
const SIZE = 380;
const CX = SIZE / 2;
const CY = SIZE / 2;
const OUTER_R = 160;
const INNER_R = 105;
const MINOR_R = 70;

function polarToXY(angleDeg: number, r: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CX + r * Math.cos(rad),
    y: CY + r * Math.sin(rad),
  };
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

export default function CircleOfFifths() {
  const { key, scale, setKey } = useComposerStore();
  const diatonicChords = getDiatonicChords(key, scale);
  const diatonicRoots = new Set(diatonicChords.map((c) => c.root));

  // Normalize current key to match circle display
  const normalizedKey = key;

  async function handleMajorClick(majorKey: string) {
    // Strip flats/sharps for internal root; use as-is (circle uses sharps/flats)
    setKey(majorKey);
    const notes = getChordNotes(majorKey, "Maj", [], 0);
    await playChord(notes);
  }

  async function handleMinorClick(minorLabel: string) {
    // minorLabel is like "Am", "Em" etc. — strip 'm'
    const root = minorLabel.replace("m", "");
    const notes = getChordNotes(root, "Min", [], 0);
    await playChord(notes);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <h3 className="text-xs font-semibold tracking-widest opacity-50 uppercase">Circle of Fifths</h3>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="select-none"
      >
        {CIRCLE_KEYS.map((ck, i) => {
          const startAngle = ck.angle - 15;
          const endAngle = ck.angle + 15;
          const midAngle = ck.angle;

          const isCurrentKey = ck.major === normalizedKey;
          const isDiatonic = diatonicRoots.has(ck.major);

          // Major outer ring
          const majorFill = isCurrentKey
            ? "#4a6fa5"
            : isDiatonic
            ? "#2a3a55"
            : "#1e2535";

          const majorStroke = isCurrentKey ? "#6a9fd8" : "#2d3a50";

          // Minor inner ring
          const minorRoot = ck.minor.replace("m", "");
          const isMinorDiatonic = diatonicRoots.has(minorRoot);
          const minorFill = isMinorDiatonic ? "#1e2e40" : "#171e2c";

          const majorLabelPos = polarToXY(midAngle, (OUTER_R + INNER_R) / 2);
          const minorLabelPos = polarToXY(midAngle, (INNER_R + MINOR_R) / 2);

          return (
            <g key={i}>
              {/* Major segment */}
              <path
                d={slicePath(startAngle, endAngle, INNER_R, OUTER_R)}
                fill={majorFill}
                stroke={majorStroke}
                strokeWidth="1"
                className="cursor-pointer transition-all duration-150 hover:brightness-125"
                onClick={() => handleMajorClick(ck.major)}
              />
              <text
                x={majorLabelPos.x}
                y={majorLabelPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="13"
                fontWeight={isCurrentKey ? "700" : "500"}
                fill={isCurrentKey ? "#ffffff" : "#a0aec0"}
                className="pointer-events-none"
              >
                {ck.major}
              </text>

              {/* Minor segment */}
              <path
                d={slicePath(startAngle, endAngle, MINOR_R, INNER_R)}
                fill={minorFill}
                stroke="#1e2a3a"
                strokeWidth="1"
                className="cursor-pointer transition-all duration-150 hover:brightness-125"
                onClick={() => handleMinorClick(ck.minor)}
              />
              <text
                x={minorLabelPos.x}
                y={minorLabelPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
                fill="#718096"
                className="pointer-events-none"
              >
                {ck.minor}
              </text>
            </g>
          );
        })}

        {/* Center label */}
        <circle cx={CX} cy={CY} r={MINOR_R - 2} fill="#131820" />
        <text
          x={CX}
          y={CY - 8}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="20"
          fontWeight="700"
          fill="#e2e8f0"
        >
          {normalizedKey}
        </text>
        <text
          x={CX}
          y={CY + 14}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="11"
          fill="#718096"
        >
          {scale === "major" ? "Major" : scale === "naturalMinor" ? "Minor" : scale}
        </text>
      </svg>
    </div>
  );
}
