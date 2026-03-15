"use client";

import { useState, useRef, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useComposerStore, NoteDuration, ChordItem } from "@/store/useComposerStore";
import { getChordNotes, ChordType } from "@/lib/musicTheory";
import { playChord, strumChord, stopAll } from "@/lib/audioEngine";
import ChordCard from "./ChordCard";

const DURATION_CYCLE: NoteDuration[] = ["4n", "8n", "8t", "16n"];

function cycleChordDuration(chord: ChordItem): Partial<ChordItem> {
  if (chord.isRest) return { isRest: false, duration: "4n" };
  const idx = DURATION_CYCLE.indexOf(chord.duration ?? "4n");
  if (idx === DURATION_CYCLE.length - 1) return { isRest: true };
  return { duration: DURATION_CYCLE[idx + 1] };
}

const DURATION_PIPS: Record<NoteDuration, number> = { "4n": 1, "8n": 2, "8t": 3, "16n": 4 };
const DURATION_LABELS: Record<NoteDuration, string> = {
  "4n": "Quarter note — click to shorten",
  "8n": "Eighth note — click to shorten",
  "8t": "Eighth triplet — click to shorten",
  "16n": "Sixteenth note — click to make rest",
};

function DurationIndicator({
  isRest, duration, onClick,
}: {
  isRest: boolean;
  duration: NoteDuration;
  onClick: (e: React.MouseEvent) => void;
}) {
  const title = isRest ? "Rest — click to restore as quarter note" : DURATION_LABELS[duration];
  return (
    <div className="beat-indicator" onClick={onClick} title={title}>
      {isRest ? (
        <span className="beat-rest" />
      ) : (
        Array.from({ length: DURATION_PIPS[duration] }).map((_, i) => (
          <span key={i} className="beat-pip" />
        ))
      )}
    </div>
  );
}

export default function Timeline() {
  // Granular selectors — Timeline won't re-render when unrelated state (midiNotes, strum, bpm…) changes
  const timeline        = useComposerStore((s) => s.timeline);
  const selectedChordId = useComposerStore((s) => s.selectedChordId);
  const reorderTimeline = useComposerStore((s) => s.reorderTimeline);
  const generateChord   = useComposerStore((s) => s.generateChord);
  const removeChord     = useComposerStore((s) => s.removeChord);
  const addChord        = useComposerStore((s) => s.addChord);
  const addRest         = useComposerStore((s) => s.addRest);
  const updateChord     = useComposerStore((s) => s.updateChord);

  // Measure scroll container to fill it edge-to-edge without overflowing
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerW(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Each slot: 54px circle + 6px flex gap = 60px.
  // Every 4th slot gets an extra 6px margin-left (bar-start), so real average ≈ 61.5px.
  // Reserve: 24px seq-row padding + 60px for the + button slot.
  const slotsFromWidth = containerW > 0
    ? Math.max(4, Math.floor((containerW - 84) / 62))
    : 16;
  // Use exactly what fits — no rounding up to bars (bar markers are visual only)
  const totalSlots = Math.max(timeline.length, slotsFromWidth);
  const emptyCount = Math.max(0, totalSlots - timeline.length);

  const [isPlaying, setIsPlaying]     = useState(false);
  const [isLooping, setIsLooping]     = useState(false);
  const [isDragOver, setIsDragOver]   = useState(false);
  const [playingIndex, setPlayingIndex] = useState(-1);
  const timeoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoopingRef = useRef(false);
  const timelineRef  = useRef(timeline);
  // Ref to playAt so setTimeout always calls the latest render's version,
  // avoiding stale closure over timeline/strum/etc.
  const playAtRef    = useRef<(index: number) => void>(() => {});

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Keep refs in sync so closures always see current values
  useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);
  useEffect(() => { timelineRef.current = timeline; }, [timeline]);

  // Clean up on unmount
  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  function stop() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsPlaying(false);
    setPlayingIndex(-1);
    stopAll();
    useComposerStore.getState().setPreviewChord(null);
  }

  function getDurationMs(duration?: NoteDuration): number {
    const quarter = 60000 / useComposerStore.getState().bpm;
    switch (duration) {
      case "8n":  return quarter * 0.5;
      case "8t":  return quarter / 3;
      case "16n": return quarter * 0.25;
      default:    return quarter; // "4n"
    }
  }

  function playAt(index: number) {
    // Always read the live timeline — picks up newly added chords and
    // duration changes on the very next beat without stopping playback.
    const live = timelineRef.current;
    if (index >= live.length) {
      if (isLoopingRef.current) {
        playAtRef.current(0);
      } else {
        setIsPlaying(false);
        setPlayingIndex(-1);
        useComposerStore.getState().setPreviewChord(null);
      }
      return;
    }
    setPlayingIndex(index);
    const chord = live[index];
    const intervalMs = getDurationMs(chord.duration);
    const { strum, strumSpeed, strumDirection, setPreviewChord } = useComposerStore.getState();
    if (!chord.isRest) {
      const notes = getChordNotes(chord.root, chord.type, chord.embellishments, chord.inversion, chord.octave);
      const durationSec = `${intervalMs / 1000}`;
      setPreviewChord({ root: chord.root, type: chord.type, embellishments: chord.embellishments });
      if (strum) {
        strumChord(notes, durationSec, strumSpeed, strumDirection);
      } else {
        playChord(notes, durationSec);
      }
    } else {
      setPreviewChord(null);
    }
    timeoutRef.current = setTimeout(() => playAtRef.current(index + 1), intervalMs);
  }
  // Update on every render so setTimeout callbacks always call the latest version
  playAtRef.current = playAt;

  function handlePlay() {
    if (timeline.length === 0 || isPlaying) return;
    setIsPlaying(true);
    playAt(0);
  }

  function handleChordDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const raw = e.dataTransfer.getData("application/chord-def");
    if (!raw) return;
    const def = JSON.parse(raw) as { root: string; type: ChordType; embellishments?: string[] };
    addChord({
      id: Math.random().toString(36).slice(2, 9),
      root: def.root,
      type: def.type,
      embellishments: def.embellishments ?? [],
      inversion: 0,
      octave: 4,
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderTimeline(String(active.id), String(over.id));
    }
  }

  return (
    <div className="timeline">
      <div className="timeline__header">
        <span className="timeline__label">TIMELINE</span>
        <div className="timeline__transport">
          <button
            onClick={() => setIsLooping((v) => !v)}
            className={`transport-btn${isLooping ? " transport-btn--active" : ""}`}
            title={isLooping ? "Loop on" : "Loop off"}
          >
            <LoopIcon />
          </button>
          {isPlaying ? (
            <button onClick={stop} className="transport-btn transport-btn--stop" title="Stop">
              <StopIcon />
            </button>
          ) : (
            <button
              onClick={handlePlay}
              className="transport-btn transport-btn--play"
              disabled={timeline.length === 0}
              title="Play all chords"
            >
              <PlayIcon />
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className={`timeline__scroll${isDragOver ? " timeline__scroll--drag-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleChordDrop}
      >
        <DndContext
          id="timeline-dnd"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={timeline.map((c) => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="seq-row">
              {timeline.map((chord, i) => (
                <div
                  key={chord.id}
                  className={`chord-slot${i % 4 === 0 ? " chord-slot--bar-start" : ""}`}
                >
                  <button
                    className="chord-delete-btn"
                    onClick={() => removeChord(chord.id)}
                    title="Remove chord"
                  >
                    ×
                  </button>
                  <ChordCard
                    chord={chord}
                    isSelected={chord.id === selectedChordId}
                    isCurrentlyPlaying={isPlaying && i === playingIndex}
                  />
                  <DurationIndicator
                    isRest={!!chord.isRest}
                    duration={chord.duration ?? "4n"}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateChord(chord.id, cycleChordDuration(chord));
                    }}
                  />
                </div>
              ))}

              {/* Empty slots — show hollow circles for rests / available beats */}
              {Array.from({ length: emptyCount }).map((_, i) => {
                const slotIndex = timeline.length + i;
                return (
                  <div
                    key={`empty-${i}`}
                    className={`chord-slot${slotIndex % 4 === 0 ? " chord-slot--bar-start" : ""}`}
                    onClick={() => generateChord()}
                    title="Click to add a chord"
                  >
                    <div className="seq-empty-circle">
                      <span className="seq-empty-plus">+</span>
                    </div>
                    <div
                      className="beat-indicator"
                      title="Click to add a rest"
                      onClick={(e) => { e.stopPropagation(); addRest(); }}
                    >
                      <span className="beat-rest" style={{ opacity: 0.35 }} />
                    </div>
                  </div>
                );
              })}

              {/* Add chord button */}
              <div className="chord-slot chord-slot--bar-start">
                <button
                  onClick={() => generateChord()}
                  className="add-chord-btn"
                  title="Add chord"
                >
                  +
                </button>
                <div className="seq-dot" />
              </div>
            </div>

          </SortableContext>
        </DndContext>

        {timeline.length === 0 && (
          <div className="empty-timeline">
            <p>No chords yet. Click <strong>+ Add Chord</strong> or generate from the Circle of Fifths.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LoopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}
