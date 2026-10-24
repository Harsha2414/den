"use client";
import { useEffect, useRef } from "react";
import Sheet from "./Sheet";

/**
 * Full emoji picker (search, categories, recent). Loaded only when opened, so it doesn't slow down the app.
 * Uses emoji-mart's own picker element (MIT licence).
 */
export default function EmojiPicker({ onPick, onClose, title = "Emoji" }: { onPick: (emoji: string) => void; onClose: () => void; title?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    let cancelled = false;
    let el: HTMLElement | null = null;
    (async () => {
      const [{ Picker }, data] = await Promise.all([import("emoji-mart"), import("@emoji-mart/data").then((m) => m.default)]);
      if (cancelled || !box.current) return;
      const dark = document.documentElement.dataset.theme === "dark"
        || (!document.documentElement.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
      el = new Picker({
        data, theme: dark ? "dark" : "light", previewPosition: "none", skinTonePosition: "search", navPosition: "bottom",
        perLine: 8, emojiSize: 26, emojiButtonSize: 40, maxFrequentRows: 2, set: "native",
        onEmojiSelect: (e: { native: string }) => pickRef.current(e.native),
      }) as unknown as HTMLElement;
      box.current.appendChild(el);
    })();
    return () => { cancelled = true; el?.remove(); };
  }, []);

  return (
    <Sheet title={title} onClose={onClose}>
      <div ref={box} className="emoji-box"><span className="spinner" /></div>
    </Sheet>
  );
}
