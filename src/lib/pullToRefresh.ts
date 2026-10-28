"use client";
import { useEffect, useRef, useState } from "react";

const TRIGGER = 72;

/**
 * Pull down from the top of the page to refresh (touch screens only).
 * Returns how far the page is pulled (for the indicator) and whether it's refreshing.
 */
export function usePullToRefresh(onRefresh: () => Promise<unknown>, enabled = true) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);
  const cb = useRef(onRefresh);
  cb.current = onRefresh;
  const pullRef = useRef(0);

  useEffect(() => {
    if (!enabled || !("ontouchstart" in window)) return;
    const down = (e: TouchEvent) => {
      if (window.scrollY > 0 || busy || document.body.style.overflow === "hidden") return;
      start.current = e.touches[0].clientY;
    };
    const move = (e: TouchEvent) => {
      if (start.current === null) return;
      const d = e.touches[0].clientY - start.current;
      if (d <= 0 || window.scrollY > 0) { pullRef.current = 0; setPull(0); return; }
      // Resistance: the further you pull, the slower it moves.
      const p = Math.min(120, d * 0.5);
      pullRef.current = p; setPull(p);
    };
    const up = async () => {
      if (start.current === null) return;
      start.current = null;
      if (pullRef.current >= TRIGGER * 0.75) {
        setBusy(true); setPull(48);
        try { await cb.current(); } finally { setBusy(false); setPull(0); pullRef.current = 0; }
      } else { setPull(0); pullRef.current = 0; }
    };
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", up);
    window.addEventListener("touchcancel", up);
    return () => {
      window.removeEventListener("touchstart", down); window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up); window.removeEventListener("touchcancel", up);
    };
  }, [enabled, busy]);

  return { pull, busy, ready: pull >= TRIGGER * 0.75 };
}
