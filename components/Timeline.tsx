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
import { playChord, strumChord, stopAll } from "@/lib/audioEngine";
import ChordCard from "./ChordCard";

export default function Timeline() {
  const { timeline, selectedChordId, bpm, strum, strumSpeed, strumDirection, reorderTimeline, generateChord, removeChord, addChord } =
    useComposerStore();

  const [isPlaying, setIsPlaying]     = useState(false);
  const [isLooping, setIsLooping]     = useState(false);
  const [isDragOver, setIsDragOver]   = useState(false);
  const [playingIndex, setPlayingIndex] = useState(-1);
  const timeoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoopingRef = useRef(false);
  const snapshotRef  = useRef(timeline);
  const timelineRef  = useRef(timeline);
  const bpmRef       = useRef(bpm);
  // Ref to playAt so setTimeout always calls the latest render's version,
  // avoiding stale closure over timeline/strum/etc.
  const playAtRef    = useRef<(index: number, snapshot: typeof timeline) => void>(() => {});

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Keep refs in sync so closures always see current values
  useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);
  useEffect(() => { timelineRef.current = timeline; }, [timeline]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);

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

  function playAt(index: number, snapshot: typeof timeline) {
    const intervalMs = (60000 / bpmRef.current) * 2;
    if (index >= snapshot.length) {
      if (isLoopingRef.current) {
        const fresh = [...timelineRef.current];
        snapshotRef.current = fresh;
        playAtRef.current(0, fresh);
      } else {
        setIsPlaying(false);
        setPlayingIndex(-1);
      }
      return;
    }
    setPlayingIndex(index);
    const chord = snapshot[index];
    const notes = getChordNotes(chord.root, chord.type, chord.embellishments, chord.inversion, chord.octave);
    const durationSec = `${intervalMs / 1000}`;
    if (strum) {
      strumChord(notes, durationSec, strumSpeed, strumDirection);
    } else {
      playChord(notes, durationSec);
    }
    timeoutRef.current = setTimeout(
      () => playAtRef.current(index + 1, snapshot),
      intervalMs
    );
  }
  // Update on every render so the setTimeout callbacks always call the
  // latest version (picks up new timeline, strum settings, etc.)
  playAtRef.current = playAt;

  function handlePlay() {
    if (timeline.length === 0 || isPlaying) return;
    snapshotRef.current = [...timeline];
    setIsPlaying(true);
    playAt(0, snapshotRef.current);
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
