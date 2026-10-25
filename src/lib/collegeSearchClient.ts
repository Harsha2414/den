"use client";
// The app's side of instant college search: starts the background thread and asks it for matches.
import type { IndexHit } from "./collegeIndex";

let worker: Worker | null = null;
let ready: Promise<boolean> | null = null;
let isReady = false;
let nextId = 0;
const waiting = new Map<number, (hits: IndexHit[] | null) => void>();

/** Start loading the list (only the first call does anything). Resolves true once searching on the phone works. */
export function preloadColleges(): Promise<boolean> {
  if (typeof window === "undefined" || typeof Worker === "undefined") return Promise.resolve(false);
  if (!ready) {
    ready = new Promise<boolean>((resolve) => {
      try {
        worker = new Worker(new URL("./collegeWorker.ts", import.meta.url));
      } catch { resolve(false); return; }
      worker.onmessage = (e: MessageEvent) => {
        const m = e.data;
        if (m.type === "ready") { isReady = !!m.ok; resolve(isReady); }
        else if (m.type === "result") { waiting.get(m.id)?.(m.hits); waiting.delete(m.id); }
      };
      worker.onerror = () => resolve(false);
      worker.postMessage({ type: "load", origin: window.location.origin });
    });
  }
  return ready;
}

export function collegesReady() { return isReady; }

/** Search on the phone. Resolves null if the list isn't loaded (ask the database instead). */
export function searchLocal(q: string, lim = 8): Promise<IndexHit[] | null> {
  if (!worker || !isReady) return Promise.resolve(null);
  const id = ++nextId;
  return new Promise((resolve) => { waiting.set(id, resolve); worker!.postMessage({ type: "search", id, q, lim }); });
}
