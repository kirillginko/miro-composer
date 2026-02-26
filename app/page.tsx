import AudioPreloader from "@/components/AudioPreloader";
import Toolbar from "@/components/Toolbar";
import CircleOfFifths from "@/components/CircleOfFifths";
import ScaleChords from "@/components/ScaleChords";
import Modulations from "@/components/Modulations";
import ModalChords from "@/components/ModalChords";
import ChordEditor from "@/components/ChordEditor";
import PianoRoll from "@/components/PianoRoll";
import Timeline from "@/components/Timeline";

export default function Home() {
  return (
    <>
      <AudioPreloader />
      <Toolbar />
      <div className="main-layout">
        <div className="left-panel">
          <div className="left-panel__inner">
            <CircleOfFifths />
            <ScaleChords />
            <Modulations />
            <ModalChords />
          </div>
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
