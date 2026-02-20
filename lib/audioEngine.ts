"use client";

import type * as ToneType from "tone";

let Tone: typeof ToneType | null = null;
let synth: ToneType.PolySynth | null = null;

async function loadTone(): Promise<typeof ToneType> {
  if (!Tone) {
    Tone = await import("tone");
  }
  return Tone;
}

async function getSynth(): Promise<ToneType.PolySynth> {
  const T = await loadTone();
  if (!synth) {
    synth = new T.PolySynth(T.Synth, {
      oscillator: { type: "triangle" },
      envelope: {
        attack: 0.02,
        decay: 0.3,
        sustain: 0.4,
        release: 1.2,
      },
      volume: -8,
    }).toDestination();

    // Add a touch of reverb for warmth
    const reverb = new T.Reverb({ decay: 2, wet: 0.25 }).toDestination();
    synth.connect(reverb);
  }
  return synth;
}

export async function playChord(
  notes: string[],
  duration = "2n"
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const T = await loadTone();
    await T.start();
    const s = await getSynth();
    s.triggerAttackRelease(notes, duration);
  } catch (e) {
    console.error("Audio playback error:", e);
  }
}

export async function stopAll(): Promise<void> {
  if (!synth) return;
  synth.releaseAll();
}
