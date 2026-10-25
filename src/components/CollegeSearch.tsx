"use client";
import { useEffect, useId, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { collegesReady, preloadColleges, searchLocal } from "@/lib/collegeSearchClient";

export type CollegeHit = { id: string; name: string; city?: string | null; state?: string | null; students?: number };

/** Search every college in India (about 70,000) by name, short name ("IITB", "DU") or city.
 *  Uses the list on the phone when it has loaded (instant), otherwise asks the database. */
export async function searchColleges(q: string, lim = 8): Promise<CollegeHit[]> {
  if (q.trim().length < 2) return [];
  const local = await searchLocal(q, lim);
  if (local) return local;
  const { data, error } = await supabaseBrowser().rpc("search_colleges", { q, lim });
  if (error) throw error;
  return (data || []) as CollegeHit[];
}

export function placeOf(c: CollegeHit) {
  return [c.city, c.state].filter(Boolean).join(", ");
}

/**
 * A search box with a list of matches. Shows `suggestions` (for example colleges already on Den) before typing.
 * `footer` renders under the matches (an "Add your college" link, say).
 */
export default function CollegeSearch({ id, onPick, suggestions = [], placeholder = "Type your college's name", autoFocus, footer, className = "", label }: {
  id?: string; onPick: (c: CollegeHit) => void; suggestions?: CollegeHit[]; placeholder?: string; autoFocus?: boolean;
  footer?: React.ReactNode; className?: string; label?: string;
}) {
  const auto = useId();
  const inputId = id || `cs-${auto}`;
  const listId = `${inputId}-list`;
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<CollegeHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const seq = useRef(0);
  const [, setLocalReady] = useState(false);

  // Start loading the India list in the background as soon as a search box appears.
  useEffect(() => { preloadColleges().then(setLocalReady); }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); setState("idle"); return; }
    const mine = ++seq.current;
    const run = async () => {
      try {
        const r = await searchColleges(term, 8);
        if (mine === seq.current) { setHits(r); setActive(0); setState("idle"); }
      } catch {
        if (mine === seq.current) setState("error");
      }
    };
    // On the phone: search on every letter, no waiting. From the database: wait for a short pause in typing.
    if (collegesReady()) { run(); return; }
    setState("loading");
    const t = window.setTimeout(run, 120);
    return () => window.clearTimeout(t);
  }, [q]);

  const showing = q.trim().length >= 2 ? hits : suggestions.slice(0, 8);
  function choose(c: CollegeHit) { onPick(c); setQ(""); setOpen(false); }

  return (
    <div className={`csearch ${className}`}>
      {label && <label htmlFor={inputId}>{label}</label>}
      <input id={inputId} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" autoComplete="off"
        autoFocus={autoFocus} placeholder={placeholder} value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 160)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, showing.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === "Enter" && open && showing[active]) { e.preventDefault(); choose(showing[active]); }
          else if (e.key === "Escape") setOpen(false);
        }} />
      {open && (showing.length > 0 || q.trim().length >= 2 || footer) && (
        <ul id={listId} role="listbox" className="csearch-list">
          {q.trim().length < 2 && showing.length > 0 && <li className="csearch-note" role="presentation">Colleges already on Den</li>}
          {showing.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); choose(c); }} onMouseEnter={() => setActive(i)}>
              <b>{c.name}</b>
              <small>{placeOf(c)}{c.students ? ` · ${c.students} on Den` : ""}</small>
            </li>
          ))}
          {q.trim().length >= 2 && state === "loading" && hits.length === 0 && <li className="csearch-note" role="presentation">Searching…</li>}
          {q.trim().length >= 2 && state === "idle" && hits.length === 0 && <li className="csearch-note" role="presentation">No college found for “{q.trim()}”. Try a shorter name or the city.</li>}
          {state === "error" && <li className="csearch-note" role="presentation">Search isn’t working right now. Try again in a moment.</li>}
          {footer && <li className="csearch-foot" role="presentation" onMouseDown={(e) => e.preventDefault()}>{footer}</li>}
        </ul>
      )}
    </div>
  );
}
