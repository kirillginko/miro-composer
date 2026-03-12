"use client";
import { memo, useEffect } from "react";
import { useComposerStore } from "@/store/useComposerStore";

export const PanelSlideH = memo(function PanelSlideH({
  children,
}: {
  children: React.ReactNode;
}) {
  const show = useComposerStore((s) => s.showChordEditor);

  useEffect(() => {
    const el = document.getElementById("main-layout");
    if (!el) return;
    el.classList.toggle("main-layout--no-editor", !show);
  }, [show]);

  return (
    <div className={`right-panel panel-slide-h${show ? " panel-slide-h--visible" : " panel-slide-h--hidden"}`}>
      {children}
    </div>
  );
});
