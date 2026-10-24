"use client";
import { useEffect, useRef } from "react";
import Sheet from "./Sheet";

/**
 * Full emoji picker (search, categories, recent). Loaded only when opened, so it doesn't slow down the app.
 * Uses emoji-mart's own picker element (MIT licence).
 */
export default function EmojiPicker({ onPick, onClose, title = "Emoji", inline = false }: {
  onPick: (emoji: string) => void; onClose: () => void; title?: string;
  /** inline: a panel that sits above the message box (the message stays visible), instead of a sheet. */
  inline?: boolean;
}) {
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
        perLine: inline ? 9 : 8, emojiSize: 26, emojiButtonSize: 40, maxFrequentRows: 2, set: "native",
        dynamicWidth: inline,
        onEmojiSelect: (e: { native: string }) => pickRef.current(e.native),
      }) as unknown as HTMLElement;
      box.current.appendChild(el);
    })();
    return () => { cancelled = true; el?.remove(); };
  }, []);

  useEffect(() => {
    if (!inline) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [inline, onClose]);

  if (inline) {
    return (
      <div className="emoji-panel" role="dialog" aria-label={title}>
        <div ref={box} className="emoji-box inline"><span className="spinner" /></div>
      </div>
    );
  }
  return (
    <Sheet title={title} onClose={onClose}>
      <div ref={box} className="emoji-box"><span className="spinner" /></div>
    </Sheet>
  );
}
