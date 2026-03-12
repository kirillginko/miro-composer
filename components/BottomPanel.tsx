"use client";
import { memo } from "react";
import { useComposerStore } from "@/store/useComposerStore";

export const BottomPanel = memo(function BottomPanel({
  children,
}: {
  children: React.ReactNode;
}) {
  const showTimeline = useComposerStore((s) => s.showTimeline);
  const showPianoRoll = useComposerStore((s) => s.showPianoRoll);
  const hidden = !showTimeline && !showPianoRoll;
  return (
    <div className={`bottom-panel${hidden ? " bottom-panel--hidden" : ""}`}>
      {children}
    </div>
  );
});
