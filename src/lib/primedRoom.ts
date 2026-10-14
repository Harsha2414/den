"use client";
import { Room } from "livekit-client";

/**
 * Phones only allow sound after a tap. When a host taps "Go live", we create the
 * voice room inside that tap and unlock audio, then hand it to the Space page so the
 * host lands straight in the room with sound working.
 */
let primed: { room: Room; at: number } | null = null;

export function newAudioRoom(): Room {
  const room = new Room({ webAudioMix: true });
  room.startAudio().catch(() => {});
  return room;
}

export function primeRoom(): Room {
  const room = newAudioRoom();
  primed = { room, at: Date.now() };
  return room;
}

export function takePrimedRoom(): Room | null {
  const p = primed;
  primed = null;
  return p && Date.now() - p.at < 2 * 60 * 1000 ? p.room : null;
}
