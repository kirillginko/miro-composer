"use client";

import type * as ToneType from "tone";

export type VoiceType = "synth" | "piano" | "organ";

let Tone: typeof ToneType | null = null;
let currentVoice: VoiceType = "synth";

// Cache holds either PolySynth or Sampler — both share the same playback interface
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const synthCache = new Map<VoiceType, any>();

// For voices that load audio files (Sampler), store a promise that resolves
// when all buffers are ready. getActiveSynth awaits it before returning.
const loadPromises = new Map<VoiceType, Promise<void>>();

// ── Salamander Grand Piano constants ─────────────────────────────────────────
const SALAMANDER_BASE = "https://tonejs.github.io/audio/salamander/";
const SALAMANDER_NOTES: Record<string, string> = {
  A0: "A0.mp3",   C1: "C1.mp3",   "D#1": "Ds1.mp3", "F#1": "Fs1.mp3",
  A1: "A1.mp3",   C2: "C2.mp3",   "D#2": "Ds2.mp3", "F#2": "Fs2.mp3",
  A2: "A2.mp3",   C3: "C3.mp3",   "D#3": "Ds3.mp3", "F#3": "Fs3.mp3",
  A3: "A3.mp3",   C4: "C4.mp3",   "D#4": "Ds4.mp3", "F#4": "Fs4.mp3",
  A4: "A4.mp3",   C5: "C5.mp3",   "D#5": "Ds5.mp3", "F#5": "Fs5.mp3",
  A5: "A5.mp3",   C6: "C6.mp3",   "D#6": "Ds6.mp3", "F#6": "Fs6.mp3",
  A6: "A6.mp3",   C7: "C7.mp3",   "D#7": "Ds7.mp3", "F#7": "Fs7.mp3",
  A7: "A7.mp3",   C8: "C8.mp3",
};

// Phase 1 results: raw compressed bytes (fetched without AudioContext)
const rawSamples = new Map<string, ArrayBuffer>();
// Phase 1 results: decoded PCM buffers (decoded with OfflineAudioContext, no gesture)
const decodedSamples = new Map<string, AudioBuffer>();

// Guards against running preFetchPianoSamples() more than once
let prefetchStarted = false;

// Set synchronously by beginAudioInit(); getActiveSynth awaits it so chord
// playback always waits for synths to be ready before triggering notes.
let initPromise: Promise<void> | null = null;

async function loadTone(): Promise<typeof ToneType> {
  if (!Tone) Tone = await import("tone");
  return Tone;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSynth(T: typeof ToneType, voice: VoiceType): any {
  switch (voice) {

    // ── Grand Piano ─────────────────────────────────────────────────────────
    // Uses pre-decoded AudioBuffers when available (instant onload), otherwise
    // falls back to CDN URL strings. Signal chain: Sampler → Reverb → out.
    case "synth": {
      const reverb = new T.Reverb({ decay: 2.5, wet: 0.2, preDelay: 0.01 }).toDestination();
      let onReady!: () => void;
      loadPromises.set("synth", new Promise<void>((resolve) => { onReady = resolve; }));

      const useDecoded = decodedSamples.size > 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const urls: Record<string, any> = useDecoded
        ? Object.fromEntries(decodedSamples)
        : Object.fromEntries(Object.entries(SALAMANDER_NOTES).map(([n, f]) => [n, f]));

      // When urls contains AudioBuffer values, Sampler fires onload synchronously
      // → loadPromise resolves instantly → getActiveSynth returns without delay.
      return new T.Sampler({
        urls,
        release: 1.5,
        ...(useDecoded ? {} : { baseUrl: SALAMANDER_BASE }),
        onload: onReady,
        onerror: (err) => {
          console.error("Piano samples failed to load:", err);
          onReady(); // resolve anyway so playback is never permanently blocked
        },
      }).connect(reverb);
    }

    // ── Rhodes Electric Piano ────────────────────────────────────────────────
    // Two-layer tine synthesis:
    //
    // Layer 1 — FM tine (harmonicity=1, ~800ms):
    //   harmonicity=1 keeps the modulator at the same pitch as the carrier,
    //   so sidebands land on the harmonic series — warm and mid-range, NOT
    //   the bright high-octave kalimba character that harmonicity=2 creates.
    //   modulationIndex=4 gives a full but gentle spectral width.
    //   The mod-envelope decays over 0.5s, so the FM harmonics gradually
    //   dissolve — the classic Rhodes "evolving from complex to simple" feel.
    //
    // Layer 2 — triangle body (~3.5s):
    //   Triangle wave has the 3rd harmonic at 1/9 amplitude — just enough
    //   to give a slightly reedy warmth above a pure sine. Long full-decay
    //   envelope (sustain=0) means the note fades completely on its own.
    //
    // Signal chain: both → lowpass filter (cuts harshness) →
    //               chorus (1.5 Hz shimmer) → reverb → out
    case "piano": {
      const reverb = new T.Reverb({ decay: 2.0, wet: 0.22 }).toDestination();
      const chorus = new T.Chorus(1.5, 3.0, 0.2).connect(reverb);
      chorus.start();
      // Lowpass cuts any residual FM brightness above ~4 kHz
      const filter = new T.Filter(4000, "lowpass").connect(chorus);

      // Layer 1: FM tine character
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tineSynth = new T.PolySynth(T.FMSynth as any, {
        harmonicity:     1,
        modulationIndex: 4,
        oscillator:         { type: "sine" },
        envelope:           { attack: 0.001, decay: 0.8, sustain: 0.1, release: 1.5 },
        modulation:         { type: "sine" },
        modulationEnvelope: { attack: 0.001, decay: 0.5, sustain: 0.0, release: 0.3 },
        volume: -9,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any) as ToneType.PolySynth;
      tineSynth.connect(filter);

      // Layer 2: warm triangle body
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bodySynth = new T.PolySynth(T.Synth as any, {
        oscillator: { type: "triangle" },
        envelope:   { attack: 0.003, decay: 3.2, sustain: 0.0, release: 1.5 },
        volume: -6,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any) as ToneType.PolySynth;
      bodySynth.connect(filter);

      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        triggerAttackRelease(notes: any, duration: any, time?: any) {
          tineSynth.triggerAttackRelease(notes, duration, time);
          bodySynth.triggerAttackRelease(notes, duration, time);
        },
        releaseAll() {
          tineSynth.releaseAll();
          bodySynth.releaseAll();
        },
      };
    }

    // ── Lo-fi Aged Organ ─────────────────────────────────────────────────────
    // Four-stage chain designed to sound worn and vintage:
    //
    // 1. Square oscillator — odd harmonics give organ character before
    //    any processing.
    // 2. Lowpass at 900 Hz — very aggressive cut. On a middle-C chord
    //    (root ≈260 Hz) only the 1st and 3rd harmonics survive cleanly;
    //    the 5th (1300 Hz) is almost gone. This is what makes it muffled.
    // 3. BitCrusher at 8 bits — 256-level quantisation adds the subtle
    //    "stepped" texture of aged digital circuitry without sounding
    //    8-bit-game harsh. Placed before the reverb so its artefacts
    //    get smoothed into the room tail naturally.
    // 4. Deep slow chorus (1.2 Hz, depth 4) — old oscillators drift and
    //    wobble; this replicates that organic instability.
    // 5. Washy reverb (wet 0.3) — glues it together and adds the sense
    //    of a small, slightly damp room.
    case "organ": {
      const reverb = new T.Reverb({ decay: 2.0, wet: 0.3 }).toDestination();
      const crusher = new T.BitCrusher(8).connect(reverb);
      const chorus = new T.Chorus(1.2, 4.0, 0.3).connect(crusher);
      chorus.start();
      const filter = new T.Filter(900, "lowpass", -24).connect(chorus);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = new T.PolySynth(T.Synth as any, {
        oscillator: { type: "square" },
        envelope: {
          attack:  0.015,
          decay:   0.01,
          sustain: 1.0,
          release: 0.12,
        },
        volume: -14,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any) as ToneType.PolySynth;
      s.connect(filter);
      return s;
    }
  }
}

export function setVoice(voice: VoiceType): void {
  const outgoing = synthCache.get(currentVoice);
  if (outgoing) outgoing.releaseAll();
  currentVoice = voice;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getActiveSynth(): Promise<any> {
  // Wait for beginAudioInit to complete (all voices built, piano onload fired).
  // initPromise is set synchronously by beginAudioInit so this is always safe.
  if (initPromise) await initPromise;

  const T = await loadTone();
  if (!synthCache.has(currentVoice)) {
    synthCache.set(currentVoice, buildSynth(T, currentVoice));
  }
  // For any voice with a pending load (shouldn't happen after initPromise, but
  // guards against direct playChord calls that bypass beginAudioInit).
  await loadPromises.get(currentVoice);
  return synthCache.get(currentVoice)!;
}

export async function playChord(
  notes: string[],
  duration = "2n"
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const T = await loadTone();
    await T.start();
    const s = await getActiveSynth();
    s.triggerAttackRelease(notes, duration);
  } catch (e) {
    console.error("Audio playback error:", e);
  }
}

const STRUM_SPEEDS: Record<string, number> = {
  slow:   0.08,
  medium: 0.05,
  fast:   0.025,
};

export async function strumChord(
  notes: string[],
  duration = "2n",
  speed: "slow" | "medium" | "fast" = "medium",
  direction: "up" | "down" = "up"
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const T = await loadTone();
    await T.start();
    const s = await getActiveSynth();
    const ordered = direction === "down" ? [...notes].reverse() : notes;
    const step = STRUM_SPEEDS[speed];
    const now = T.now();
    ordered.forEach((note, i) => {
      s.triggerAttackRelease(note, duration, now + i * step);
    });
  } catch (e) {
    console.error("Strum playback error:", e);
  }
}

export async function stopAll(): Promise<void> {
  const current = synthCache.get(currentVoice);
  if (current) current.releaseAll();
}

// ── Phase 1: pre-fetch + pre-decode piano samples on mount ───────────────────
// Runs immediately on page load — no user gesture needed:
//   1. Imports the Tone module so it's cached before the first click.
//   2. fetch()es all 28 Salamander MP3s as ArrayBuffers (plain HTTP, no
//      AudioContext involved).
//   3. Decodes them with an OfflineAudioContext (CPU-only, no gesture required)
//      and stores the resulting AudioBuffer objects in decodedSamples.
//
// When beginAudioInit later calls buildSynth("synth"), it passes the decoded
// AudioBuffers to Tone.Sampler. Sampler fires onload synchronously for
// AudioBuffer values — no network wait, no decode wait on first click.
export function preFetchPianoSamples(): void {
  if (typeof window === "undefined" || prefetchStarted) return;
  prefetchStarted = true;

  void (async () => {
    try {
      // Warm up the Tone module so import("tone") is already cached
      await loadTone();

      // Download all 28 samples in parallel
      await Promise.all(
        Object.entries(SALAMANDER_NOTES).map(async ([note, file]) => {
          try {
            const res = await fetch(SALAMANDER_BASE + file);
            if (res.ok) rawSamples.set(note, await res.arrayBuffer());
          } catch {
            // Individual failure — Sampler will fall back to CDN URL for this note
          }
        })
      );

      // Decode compressed bytes → PCM AudioBuffer using OfflineAudioContext.
      // OfflineAudioContext.decodeAudioData() is purely computational and does
      // not require the AudioContext to be "running" (i.e. no gesture needed).
      if (rawSamples.size > 0 && typeof OfflineAudioContext !== "undefined") {
        const offCtx = new OfflineAudioContext(2, 44100, 44100);
        await Promise.all(
          Array.from(rawSamples.entries()).map(async ([note, buf]) => {
            try {
              // slice() prevents detached-buffer errors if called multiple times
              decodedSamples.set(note, await offCtx.decodeAudioData(buf.slice(0)));
            } catch {
              // Leave this note out of decodedSamples; Sampler falls back to URL
            }
          })
        );
      }
    } catch (e) {
      console.error("Piano prefetch error:", e);
    }
  })();
}

// ── Phase 2: begin audio init on first user gesture ──────────────────────────
// Must be triggered by a user gesture (pointerdown) so Tone.start() can
// resume the AudioContext. Sets initPromise synchronously so getActiveSynth
// will await it — chord clicks on the same pointerdown will wait for this to
// complete before attempting to trigger notes.
export function beginAudioInit(): void {
  if (initPromise) return; // already started
  initPromise = (async () => {
    try {
      const T = await loadTone();
      await T.start();
      // Build all voices. Piano ("synth") uses decodedSamples if phase 1
      // completed — buildSynth will pass AudioBuffers to Sampler and onload
      // fires synchronously, resolving loadPromises.get("synth") instantly.
      for (const voice of ["synth", "piano", "organ"] as VoiceType[]) {
        if (!synthCache.has(voice)) {
          synthCache.set(voice, buildSynth(T, voice));
        }
      }
      // Wait for the piano sampler to signal readiness.
      // With pre-decoded buffers this resolves immediately.
      // Without them it waits for CDN downloads (graceful degradation).
      await loadPromises.get("synth");
    } catch (e) {
      console.error("Audio init error:", e);
    }
  })();
}

// Kept for any legacy callers — delegates to the new two-phase approach.
export async function preloadAll(): Promise<void> {
  beginAudioInit();
}
