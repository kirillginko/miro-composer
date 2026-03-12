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
import { PanelSlide } from "@/components/PanelSlide";
import { PanelSlideH } from "@/components/PanelSlideH";
import { BottomPanel } from "@/components/BottomPanel";
import dynamic from "next/dynamic";
const ChordMap = dynamic(() => import("@/components/ChordMap"), { ssr: false });
import { useComposerStore } from "@/store/useComposerStore";
import { memo } from "react";

const LeftPanel = memo(function LeftPanel() {
  const showChordMap = useComposerStore((s) => s.showChordMap);
  return (
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
  );
});

export default function Home() {
  return (
    <>
      <AudioPreloader />
      <MidiListener />
      <Toolbar />
      <div id="main-layout" className="main-layout">
        <LeftPanel />
        <PanelSlideH>
          <ChordEditor />
        </PanelSlideH>
        <BottomPanel>
          <PanelSlide storeKey="showPianoRoll">
            <PianoRoll />
          </PanelSlide>
          <PanelSlide storeKey="showTimeline">
            <Timeline />
          </PanelSlide>
        </BottomPanel>
      </div>
    </>
  );
}
