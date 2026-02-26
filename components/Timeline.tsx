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
import { useComposerStore } from "@/store/useComposerStore";
import { getChordNotes, ChordType } from "@/lib/musicTheory";
import { playChord, stopAll } from "@/lib/audioEngine";
import ChordCard from "./ChordCard";

export default function Timeline() {
  const { timeline, selectedChordId, bpm, reorderTimeline, generateChord, removeChord, addChord } =
    useComposerStore();

  const [isPlaying, setIsPlaying]   = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [playingIndex, setPlayingIndex] = useState(-1);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Snapshot of timeline at play-start so duration/order stays stable
  const snapshotRef = useRef(timeline);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Clean up on unmount
  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  function stop() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsPlaying(false);
    setPlayingIndex(-1);
    stopAll();
  }

  function playAt(index: number, snapshot: typeof timeline, intervalMs: number) {
    if (index >= snapshot.length) {
      setIsPlaying(false);
      setPlayingIndex(-1);
      return;
    }
    setPlayingIndex(index);
    const chord = snapshot[index];
    const notes = getChordNotes(chord.root, chord.type, chord.embellishments, chord.inversion);
    // Pass duration in seconds so it matches the BPM interval
    playChord(notes, `${intervalMs / 1000}`);
    timeoutRef.current = setTimeout(
      () => playAt(index + 1, snapshot, intervalMs),
      intervalMs
    );
  }

  function handlePlay() {
    if (timeline.length === 0 || isPlaying) return;
    // half-note duration at current BPM
    const intervalMs = (60000 / bpm) * 2;
    snapshotRef.current = [...timeline];
    setIsPlaying(true);
    playAt(0, snapshotRef.current, intervalMs);
  }

  function handleChordDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const raw = e.dataTransfer.getData("application/chord-def");
    if (!raw) return;
    const def = JSON.parse(raw) as { root: string; type: ChordType; embellishments?: string[] };
    const last = timeline[timeline.length - 1];
    addChord({
      id: Math.random().toString(36).slice(2, 9),
      root: def.root,
      type: def.type,
      embellishments: def.embellishments ?? [],
      inversion: 0,
      octave: 4,
      strum: last?.strum ?? false,
      strumSpeed: last?.strumSpeed ?? "medium",
      strumDirection: last?.strumDirection ?? "up",
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
        className={`timeline__scroll${isDragOver ? " timeline__scroll--drag-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleChordDrop}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={timeline.map((c) => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex gap-3 items-center min-w-max pt-4 pb-2">
              {timeline.map((chord, i) => (
                <div key={chord.id} className="chord-slot">
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
                </div>
              ))}
              <button
                onClick={() => generateChord()}
                className="add-chord-btn"
                title="Add chord"
              >
                + Add Chord
              </button>
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
