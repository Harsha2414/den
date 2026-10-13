"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AUTHOR_COLS } from "@/lib/format";
import type { Author } from "@/lib/types";
import { useApp } from "./AppContext";
import Avatar from "./Avatar";
import Icon, { VerifiedTick } from "./Icon";

/** Search students by name. Single mode calls onPick; multi mode shows checkboxes. */
export default function PeoplePicker({ multi, selected, onPick, onToggle }: {
  multi?: boolean;
  selected?: Set<string>;
  onPick?: (p: Author) => void;
  onToggle?: (p: Author) => void;
}) {
  const { me, collegeName } = useApp();
  const supabase = supabaseBrowser();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Author[] | null>(null);

  useEffect(() => {
    const term = q.trim().replace(/[%_,()]/g, " ");
    const t = setTimeout(async () => {
      let query = supabase.from("profiles").select(AUTHOR_COLS).neq("id", me.id);
      // Empty search: show classmates from your college first.
      query = term ? query.ilike("name", `%${term}%`) : query.eq("college_id", me.college_id);
      const { data } = await query.order("name").limit(30);
      setPeople((data || []) as Author[]);
    }, term ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, supabase, me.id, me.college_id]);

  return (
    <>
      <div className="search">
        <Icon name="search" size={17} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students by name" aria-label="Search students" />
      </div>
      {!q && <p className="note">Students from your college. Search to find anyone on Campus Adda.</p>}
      {people === null ? <p className="meta">Loading...</p> :
        people.length === 0 ? <p className="note">No students found with that name.</p> :
        people.map((p) => multi ? (
          <label key={p.id} className="chk">
            <input type="checkbox" checked={!!selected?.has(p.id)} onChange={() => onToggle?.(p)} />
            <Avatar id={p.id} name={p.name} />
            <div style={{ minWidth: 0 }}>
              <b>{p.name}{p.verified && <VerifiedTick />}</b>
              <div className="meta">{[p.branch, p.year, collegeName(p.college_id)].filter(Boolean).join(", ")}</div>
            </div>
          </label>
        ) : (
          <button key={p.id} className="pick" onClick={() => onPick?.(p)}>
            <Avatar id={p.id} name={p.name} />
            <div><b>{p.name}{p.verified && <VerifiedTick />}</b><span>{[p.branch, p.year, collegeName(p.college_id)].filter(Boolean).join(", ")}</span></div>
          </button>
        ))}
    </>
  );
}
