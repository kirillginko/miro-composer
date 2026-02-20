import Toolbar from "@/components/Toolbar";
import CircleOfFifths from "@/components/CircleOfFifths";
import ChordEditor from "@/components/ChordEditor";
import Timeline from "@/components/Timeline";

export default function Home() {
  return (
    <>
      <Toolbar />
      <div className="main-layout">
        <div className="left-panel">
          <CircleOfFifths />
        </div>
        <div className="right-panel">
          <ChordEditor />
        </div>
        <div className="bottom-panel">
          <Timeline />
        </div>
      </div>
    </>
  );
}
