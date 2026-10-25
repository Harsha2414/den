"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import { useAdmin } from "@/components/Shell";
import { ago } from "@/lib/format";

type Counts = { total: number; aishe: number; to_review: number; with_students: number };
type Suggest = { id: string; name: string; city: string; state: string };
type Pending = { id: string; name: string; city: string; created_at: string; students: number; suggestions: Suggest[] };
type Hit = { id: string; name: string; city: string | null; state: string | null; students: number };

const CHUNK = 1000;

export default function CollegesPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const { denUrl } = useAdmin();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [pending, setPending] = useState<Pending[] | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null);
  const stop = useRef(false);

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([supabase.rpc("admin_college_counts"), supabase.rpc("admin_student_colleges")]);
    if (c.error) { setErr(c.error.message.includes("admin_college_counts") ? "Run supabase/migrations/0008_college_list.sql in Supabase first." : c.error.message); setPending([]); return; }
    setCounts(c.data as Counts);
    setPending((p.data || []) as Pending[]);
  }, [supabase]);
  useEffect(() => { load(); }, [load]);

  async function importList() {
    setErr(""); setMsg(""); stop.current = false;
    let rows: unknown[];
    try { rows = await (await fetch("/data/aishe-colleges.json", { cache: "no-store" })).json(); }
    catch { return setErr("Couldn't load the college list file. Reload the page and try again."); }
    const total = rows.length;
    const sum = { added: 0, updated: 0, matched: 0 };
    setImporting({ done: 0, total });
    for (let i = 0; i < total; i += CHUNK) {
      if (stop.current) { setMsg(`Stopped at ${i.toLocaleString("en-IN")} of ${total.toLocaleString("en-IN")}. Press Import again to finish; nothing is added twice.`); break; }
      let res = await supabase.rpc("admin_import_colleges", { rows: rows.slice(i, i + CHUNK) });
      if (res.error) res = await supabase.rpc("admin_import_colleges", { rows: rows.slice(i, i + CHUNK) }); // one retry
      if (res.error) { setErr(`Stopped at ${i.toLocaleString("en-IN")}: ${res.error.message}. Press Import again to carry on.`); break; }
      const r = res.data as typeof sum;
      sum.added += r.added; sum.updated += r.updated; sum.matched += r.matched;
      setImporting({ done: Math.min(i + CHUNK, total), total });
    }
    setImporting(null);
    if (!stop.current) setMsg(`Done. ${sum.added.toLocaleString("en-IN")} colleges added, ${sum.updated.toLocaleString("en-IN")} updated, ${sum.matched} existing Den colleges matched to their official names.`);
    load(); router.refresh();
  }

  async function mark(c: Pending) {
    const { error } = await supabase.rpc("admin_mark_college", { college: c.id, ok: true });
    if (error) return setErr(error.message);
    setMsg(`${c.name} marked as right.`); load(); router.refresh();
  }
  async function merge(c: Pending, into: Suggest | Hit) {
    if (!window.confirm(`Merge “${c.name}” into “${into.name}”?\n\nIts ${c.students} student(s) and all their posts, notes and events move to ${into.name}. This can't be undone.`)) return;
    const { data, error } = await supabase.rpc("admin_merge_college", { from_id: c.id, into_id: into.id });
    if (error) return setErr(error.message);
    setMsg(`Merged into ${into.name} (${(data as { moved: number }).moved} rows moved).`); load(); router.refresh();
  }

  const left = counts ? Math.max(0, 69775 - counts.aishe) : 0;
  return (
    <div className="page wide">
      <h1>Colleges</h1>
      {err && <p className="msg bad-msg">{err}</p>}
      {msg && <p className="msg">{msg}</p>}

      {counts && (
        <div className="tiles" style={{ marginBottom: 16 }}>
          <div className="panel"><small className="muted">Colleges in Den</small><b className="big">{counts.total.toLocaleString("en-IN")}</b></div>
          <div className="panel"><small className="muted">From the official India list</small><b className="big">{counts.aishe.toLocaleString("en-IN")}</b></div>
          <div className="panel"><small className="muted">With students</small><b className="big">{counts.with_students.toLocaleString("en-IN")}</b></div>
          <div className="panel"><small className="muted">Added by students, to check</small><b className="big">{counts.to_review}</b></div>
        </div>
      )}

      <div className="panel" style={{ marginBottom: 22 }}>
        <h2>The India list</h2>
        <p className="muted" style={{ margin: "6px 0 12px" }}>
          About 70,000 universities, colleges and standalone institutes from AISHE (Ministry of Education). Importing is safe to repeat:
          colleges already in Den are updated, never duplicated, and students stay in their college.
        </p>
        {importing ? (
          <div>
            <div className="progress"><i style={{ width: `${Math.round((importing.done / importing.total) * 100)}%` }} /></div>
            <p className="muted">{importing.done.toLocaleString("en-IN")} of {importing.total.toLocaleString("en-IN")} · keep this tab open</p>
            <button className="btn small" onClick={() => { stop.current = true; }}>Stop</button>
          </div>
        ) : (
          <button className="btn primary" onClick={importList} disabled={!counts}>
            {counts && counts.aishe > 0 ? (left > 0 ? `Import the rest of the India list (${left.toLocaleString("en-IN")} left)` : "Re-import the India list") : "Import the India list"}
          </button>
        )}
      </div>

      <h2>Added by students</h2>
      <p className="muted" style={{ margin: "4px 0 12px" }}>Students can add a college that isn&rsquo;t on the list. Check each one: keep it if it&rsquo;s real, or merge it into the right college.</p>
      {pending === null ? <p className="muted">Loading...</p> : pending.length === 0 ? <div className="empty">Nothing to check.</div> : (
        <div className="list">
          {pending.map((c) => <PendingRow key={c.id} c={c} denUrl={denUrl} onKeep={() => mark(c)} onMerge={(into) => merge(c, into)} />)}
        </div>
      )}
    </div>
  );
}

function PendingRow({ c, denUrl, onKeep, onMerge }: { c: Pending; denUrl: string; onKeep: () => void; onMerge: (into: Suggest | Hit) => void }) {
  const supabase = supabaseBrowser();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("search_colleges", { q, lim: 6 });
      setHits(((data || []) as Hit[]).filter((h) => h.id !== c.id));
    }, 250);
    return () => clearTimeout(t);
  }, [q, supabase, c.id]);

  return (
    <div className="report">
      <div className="report-top">
        <b style={{ fontSize: 16 }}><a href={`${denUrl}/c/${c.id}`} target="_blank" rel="noopener noreferrer">{c.name}</a></b>
        <span className="muted">{c.city || "no city"} · {c.students} {c.students === 1 ? "student" : "students"} · added {ago(c.created_at)}</span>
      </div>
      {c.suggestions.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <small className="muted">Looks like:</small>
          <div className="chips" style={{ marginTop: 6 }}>
            {c.suggestions.map((s) => <button key={s.id} className="chip" onClick={() => onMerge(s)} title="Merge into this college">Merge into {s.name}{s.city ? `, ${s.city}` : ""}</button>)}
          </div>
        </div>
      )}
      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Or search the right college to merge into" />
      {hits.length > 0 && (
        <div className="chips" style={{ marginTop: 8 }}>
          {hits.map((h) => <button key={h.id} className="chip" onClick={() => onMerge(h)}>Merge into {h.name}{h.city ? `, ${h.city}` : ""}</button>)}
        </div>
      )}
      <div className="actions">
        <button className="btn good small" onClick={onKeep}>It&rsquo;s a real college: keep it</button>
      </div>
    </div>
  );
}
