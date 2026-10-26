"use client";
import { useEffect, useId, useState } from "react";
import { loadCourses } from "@/lib/courses";

/** Search box for branch / course / stream. Pick from the list, or keep what you typed if yours isn't there. */
export default function CourseSearch({ id, value, onChange, label = "Branch / course *" }: {
  id?: string; value: string; onChange: (v: string) => void; label?: string;
}) {
  const auto = useId();
  const inputId = id || `course-${auto}`;
  const [editing, setEditing] = useState(!value);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => { loadCourses(); }, []);
  useEffect(() => {
    let live = true;
    loadCourses().then((c) => { if (live) { setHits(c ? c.search(q, 8) : []); setActive(0); } });
    return () => { live = false; };
  }, [q]);

  const typed = q.trim().replace(/\s+/g, " ").slice(0, 60);
  const options = [...hits, ...(typed.length >= 2 && !hits.some((h) => h.toLowerCase() === typed.toLowerCase()) ? [`__own__`] : [])];
  function choose(v: string) { onChange(v); setQ(""); setOpen(false); setEditing(false); }

  if (!editing && value) {
    return (
      <div className="field">
        <label>{label}</label>
        <div className="pf-picked">
          <span><b>{value}</b></span>
          <button type="button" className="ghost" onClick={() => { setEditing(true); setQ(""); }}>Change</button>
        </div>
      </div>
    );
  }
  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <div className="csearch">
        <input id={inputId} role="combobox" aria-expanded={open} aria-controls={`${inputId}-list`} aria-autocomplete="list" autoComplete="off"
          placeholder="Type your course, e.g. B.Tech CSE, B.Sc Nursing, MBA" value={q} maxLength={60}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 160)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, options.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter" && open && options[active]) { e.preventDefault(); choose(options[active] === "__own__" ? typed : options[active]); }
            else if (e.key === "Escape") setOpen(false);
          }} />
        {open && typed.length >= 2 && (
          <ul id={`${inputId}-list`} role="listbox" className="csearch-list">
            {options.map((o, i) => (
              <li key={o} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); choose(o === "__own__" ? typed : o); }} onMouseEnter={() => setActive(i)}>
                {o === "__own__" ? <><b>Use “{typed}”</b><small>If your course isn&rsquo;t in the list</small></> : <b>{o}</b>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {value && <button type="button" className="ghost" onClick={() => setEditing(false)}>Keep “{value}”</button>}
    </div>
  );
}
