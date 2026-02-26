"use client";

import { useEffect } from "react";
import { useComposerStore } from "@/store/useComposerStore";
import { noteOn, noteOff } from "@/lib/audioEngine";

const CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function midiNoteToName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${CHROMATIC[midi % 12]}${octave}`;
}

export default function MidiListener() {
  const addMidiNote    = useComposerStore((s) => s.addMidiNote);
  const removeMidiNote = useComposerStore((s) => s.removeMidiNote);
  const setMidiStatus  = useComposerStore((s) => s.setMidiStatus);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.requestMIDIAccess) {
      // Web MIDI not supported in this browser
      return;
    }

    let midiAccess: MIDIAccess | null = null;

    function handleMessage(event: MIDIMessageEvent) {
      if (!event.data) return;
      const [status, note, velocity] = Array.from(event.data);
      const command = status & 0xf0;
      const noteName = midiNoteToName(note);

      if (command === 0x90 && velocity > 0) {
        // Note on
        addMidiNote(noteName);
        noteOn(noteName);
      } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
        // Note off (0x80 = explicit note-off; 0x90 + vel=0 = running status note-off)
        removeMidiNote(noteName);
        noteOff(noteName);
      }
    }

    function syncInputs(access: MIDIAccess) {
      let connected = false;
      let deviceName: string | null = null;
      access.inputs.forEach((input) => {
        input.onmidimessage = handleMessage;
        connected = true;
        if (!deviceName) deviceName = input.name ?? "MIDI Device";
      });
      setMidiStatus(connected, deviceName);
    }

    navigator.requestMIDIAccess({ sysex: false })
      .then((access) => {
        midiAccess = access;
        syncInputs(access);
        // Re-sync whenever devices connect or disconnect
        access.onstatechange = () => syncInputs(access);
      })
      .catch(() => {
        // User denied MIDI permission — silently ignore
      });

    return () => {
      if (midiAccess) {
        midiAccess.inputs.forEach((input) => {
          input.onmidimessage = null;
        });
      }
      setMidiStatus(false, null);
    };
  }, [addMidiNote, removeMidiNote, setMidiStatus]);

  return null;
}
