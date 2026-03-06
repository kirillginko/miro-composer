"use client";

import AudioPreloader from "@/components/AudioPreloader";
import MidiListener from "@/components/MidiListener";
import Toolbar from "@/components/Toolbar";
import CircleOfFifths from "@/components/CircleOfFifths";
import ScaleChords from "@/components/ScaleChords";
import Modulations from "@/components/Modulations";
import ModalChords from "@/components/ModalChords";
import ChordEditor from "@/components/ChordEditor";
import PianoRoll from "@/components/PianoRoll";
import Timeline from "@/components/Timeline";
import ChordMap from "@/components/ChordMap";
import { useComposerStore } from "@/store/useComposerStore";

export default function Home() {
  const showChordMap = useComposerStore((s) => s.showChordMap);

  return (
    <>
      <AudioPreloader />
      <MidiListener />
      <Toolbar />
      <div className="main-layout">
        <div className={`left-panel${showChordMap ? " left-panel--chord-map" : ""}`}>
          {showChordMap ? (
            <ChordMap />
          ) : (
            <div className="left-panel__inner">
              <CircleOfFifths />
              <ScaleChords />
              <Modulations />
              <ModalChords />
            </div>
          )}
        </div>
        <div className="right-panel">
          <ChordEditor />
        </div>
        <div className="bottom-panel">
          <PianoRoll />
          <Timeline />
        </div>
      </div>
    </>
  );
}
