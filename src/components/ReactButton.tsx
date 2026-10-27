"use client";
import { useEffect, useRef, useState } from "react";
import { REACTIONS, emojiOf, labelOf, topReactions, type Likes } from "@/lib/reactions";
import Icon from "./Icon";

const HOLD_MS = 450;

/**
 * The like button on a post. Tap: heart (or take your reaction back).
 * Long-press (or right-click on a laptop): pick one of six reactions.
 */
export default function ReactButton({ likes, onReact }: { likes: Likes; onReact: (r?: string) => void }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const held = useRef(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const scroll = () => setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", scroll, { passive: true });
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); window.removeEventListener("scroll", scroll); };
  }, [open]);

  const start = () => {
    held.current = false;
    timer.current = window.setTimeout(() => { held.current = true; setOpen(true); navigator.vibrate?.(12); }, HOLD_MS);
  };
  const stop = () => { if (timer.current) { window.clearTimeout(timer.current); timer.current = null; } };
  // Everyone's reactions, for screen readers and the tooltip (the button itself shows only yours).
  const summary = topReactions(likes.counts).map((r) => `${emojiOf(r)} ${likes.counts[r]}`).join("  ");

  return (
    <div className="react" ref={box}>
      <button type="button" className={`ghost react-btn ${likes.mine ? "on" : ""}`} aria-pressed={likes.mine} title={summary || undefined}
        aria-label={`${likes.mine ? `Your reaction: ${labelOf(likes.my)}. Tap to remove` : "Like"}${likes.n ? `, ${likes.n}` : ""}. Long-press for more reactions`}
        onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
        onContextMenu={(e) => { e.preventDefault(); stop(); setOpen(true); }}
        onClick={() => { if (held.current) { held.current = false; return; } onReact(); }}>
        {likes.my && likes.my !== "heart" ? <span className="react-mine">{emojiOf(likes.my)}</span> : <Icon name="heart" size={17} fill={likes.mine} />}
        {likes.n ? <span>{likes.n}</span> : null}
      </button>
      {open && (
        <div className="react-pick" role="menu" aria-label="Pick a reaction">
          {REACTIONS.map((r) => (
            <button key={r.id} type="button" role="menuitem" aria-label={r.label} className={likes.my === r.id ? "on" : ""}
              onClick={() => { setOpen(false); onReact(r.id); }}>
              <span>{r.emoji}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
