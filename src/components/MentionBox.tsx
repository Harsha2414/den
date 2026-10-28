"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useApp } from "./AppContext";
import Avatar from "./Avatar";

type Person = { id: string; name: string; branch: string; year: string };

/**
 * A text box (or one-line input) that suggests classmates when you type "@".
 * Picking one writes "@Name" in the box and remembers who it was (picked), so it can be saved as a mention.
 */
const MentionBox = forwardRef<HTMLTextAreaElement | HTMLInputElement, {
  value: string; onChange: (v: string) => void; picked: Record<string, string>; onPick: (name: string, id: string) => void;
  multiline?: boolean; placeholder?: string; maxLength?: number; id?: string; ariaLabel?: string; onEnter?: () => void; onEscape?: () => void; className?: string;
}>(function MentionBox({ value, onChange, picked, onPick, multiline, placeholder, maxLength, id, ariaLabel, onEnter, onEscape, className }, ref) {
  const { me } = useApp();
  const box = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  useImperativeHandle(ref, () => box.current!);
  const [q, setQ] = useState<{ text: string; start: number } | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [active, setActive] = useState(0);

  // Look at the word being typed: "@ana" -> search for "ana".
  function check(text: string, caret: number) {
    const before = text.slice(0, caret);
    const m = before.match(/(^|[\s(])@([\p{L}][\p{L}.' -]{0,29})?$/u);
    if (!m) return setQ(null);
    setQ({ text: (m[2] || "").trim(), start: caret - (m[2] || "").length - 1 });
  }

  useEffect(() => {
    if (!q) { setPeople([]); return; }
    let live = true;
    const t = window.setTimeout(async () => {
      let req = supabaseBrowser().from("profiles").select("id,name,branch,year").neq("id", me.id).limit(6);
      req = q.text ? req.ilike("name", `%${q.text.replace(/[%_]/g, "")}%`) : req.eq("college_id", me.college_id);
      const { data } = await req.order("name");
      if (live) { setPeople((data || []) as Person[]); setActive(0); }
    }, 120);
    return () => { live = false; window.clearTimeout(t); };
  }, [q, me.id, me.college_id]);

  function choose(p: Person) {
    if (!q) return;
    const caret = box.current?.selectionStart ?? value.length;
    const next = `${value.slice(0, q.start)}@${p.name} ${value.slice(caret)}`;
    onChange(next); onPick(p.name, p.id); setQ(null);
    const pos = q.start + p.name.length + 2;
    requestAnimationFrame(() => { box.current?.focus(); box.current?.setSelectionRange(pos, pos); });
  }

  const props = {
    ref: box, id, value, placeholder, maxLength, "aria-label": ariaLabel, className,
    "aria-autocomplete": "list" as const, "aria-expanded": !!(q && people.length),
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => { onChange(e.target.value); check(e.target.value, e.target.selectionStart ?? e.target.value.length); },
    onBlur: () => window.setTimeout(() => setQ(null), 150),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (q && people.length) {
        if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, people.length - 1)); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); return; }
        if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); choose(people[active]); return; }
        if (e.key === "Escape") { setQ(null); return; }
      }
      if (e.key === "Enter" && !multiline && onEnter) { e.preventDefault(); onEnter(); }
      if (e.key === "Escape") onEscape?.();
    },
  };
  void picked;
  return (
    <div className="mention-wrap">
      {multiline ? <textarea {...props} /> : <input {...props} />}
      {q && people.length > 0 && (
        <ul className="mention-list" role="listbox">
          {people.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); choose(p); }} onMouseEnter={() => setActive(i)}>
              <Avatar id={p.id} name={p.name} />
              <span><b>{p.name}</b><small>{[p.branch, p.year].filter(Boolean).join(" · ")}</small></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
export default MentionBox;
