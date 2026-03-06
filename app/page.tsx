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
import dynamic from "next/dynamic";
const ChordMap = dynamic(() => import("@/components/ChordMap"), { ssr: false });
import { useComposerStore } from "@/store/useComposerStore";

export default function Home() {
  const showChordMap = useComposerStore((s) => s.showChordMap);
  const showTimeline = useComposerStore((s) => s.showTimeline);
  const showPianoRoll = useComposerStore((s) => s.showPianoRoll);
  const showChordEditor = useComposerStore((s) => s.showChordEditor);

  return (
    <>
      <AudioPreloader />
      <MidiListener />
      <Toolbar />
      <div className={`main-layout${!showTimeline && !showPianoRoll ? " main-layout--no-bottom" : ""}${!showChordEditor ? " main-layout--no-editor" : ""}`}>
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
        <div className={`right-panel panel-slide-h${showChordEditor ? " panel-slide-h--visible" : " panel-slide-h--hidden"}`}>
          <ChordEditor />
        </div>
        <div className={`bottom-panel${!showTimeline && !showPianoRoll ? " bottom-panel--hidden" : ""}`}>
          <div className={`panel-slide${showPianoRoll ? " panel-slide--visible" : " panel-slide--hidden"}`}>
            <PianoRoll />
          </div>
          <div className={`panel-slide${showTimeline ? " panel-slide--visible" : " panel-slide--hidden"}`}>
            <Timeline />
          </div>
        </div>
      </div>
    </>
  );
}
