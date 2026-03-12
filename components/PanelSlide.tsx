"use client";
import { memo } from "react";
import { useComposerStore } from "@/store/useComposerStore";

export const PanelSlide = memo(function PanelSlide({
  storeKey,
  children,
}: {
  storeKey: "showTimeline" | "showPianoRoll";
  children: React.ReactNode;
}) {
  const show = useComposerStore((s) => s[storeKey]);
  return (
    <div className={`panel-slide${show ? " panel-slide--visible" : " panel-slide--hidden"}`}>
      <div className="panel-slide__content">{children}</div>
    </div>
  );
});
