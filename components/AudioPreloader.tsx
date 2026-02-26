"use client";

import { useEffect } from "react";
import { preFetchPianoSamples, beginAudioInit } from "@/lib/audioEngine";

// Invisible component that handles two-phase audio preloading:
//
// Phase 1 (mount — no gesture): starts fetching + decoding all 28 piano
//   sample files in the background immediately. fetch() and OfflineAudioContext
//   work without user interaction, so this runs as soon as the page loads.
//
// Phase 2 (first pointerdown): calls beginAudioInit(), which resumes the
//   AudioContext (requires gesture) and builds all synths. The piano sampler
//   receives pre-decoded AudioBuffers and fires onload synchronously, so the
//   first chord click plays with no perceptible delay.
export default function AudioPreloader() {
  useEffect(() => {
    // Start downloading + decoding immediately — no gesture needed.
    preFetchPianoSamples();

    // On first user interaction, unlock AudioContext and build all synths.
    document.addEventListener("pointerdown", beginAudioInit, { once: true });
    return () => document.removeEventListener("pointerdown", beginAudioInit);
  }, []);

  return null;
}
