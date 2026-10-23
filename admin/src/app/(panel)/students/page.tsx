"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import { useAdmin } from "@/components/Shell";
import { ago } from "@/lib/format";

type S = {
  id: string; name: string; email: string; college_id: string; branch: string; year: string; verified: boolean; verified_via: string | null;
  verified_at: string | null; banned_at: string | null; ban_reason: string; created_at: string; posts: number; reports_against: number;
};
const VIA: Record<string, string> = { email: "college email sign-in", college_email: "college email code", id_card: "ID card", classmates: "classmates", admin: "an admin" };
const FILTERS = [["all", "Everyone"], ["unverified", "Not verified"], ["verified", "Verified"], ["banned", "Banned"]] as const;

export default function StudentsPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const { collegeName, denUrl, me } = useAdmin();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [list, setList] = useState<S[] | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_find_students", { q: q.trim(), filter });
    if (error) { setMsg(error.message); setList([]); return; }
    setList((data || []) as S[]);
  }, [supabase, q, filter]);
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  async function run(fn: string, args: object, done: string) {
    setMsg("");
    const { error } = await supabase.rpc(fn, args);
    if (error) return setMsg(error.message);
    setMsg(done); load(); router.refresh();
  }
  function ban(s: S) {
    const reason = window.prompt(`Ban ${s.name}? Type a short reason for the log:`);
    if (reason === null) return;
    const fake = window.confirm("Was this a fake (not a real student) account?\n\nOK = yes, fake: classmates who vouched for them lose vouching for 90 days.\nCancel = no, banned for behaviour.");
    run("admin_ban", { who: s.id, reason, fake }, `${s.name} banned.`);
  }

  return (
    <div className="page wide">
      <h1>Students</h1>
      <input className="input search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" autoFocus />
      <div className="chips">{FILTERS.map(([k, l]) => <button key={k} className={`chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>{l}</button>)}</div>
      {msg && <p className="msg">{msg}</p>}
      {list === null ? <p className="muted">Loading...</p> : list.length === 0 ? <div className="empty">No students found.</div> : (
        <div className="table">
          <div className="thead"><span>Student</span><span>College</span><span>Status</span><span>Activity</span><span /></div>
          {list.map((s) => (
            <div key={s.id} className="trow">
              <span><b><a href={`${denUrl}/u/${s.id}`} target="_blank" rel="noopener noreferrer">{s.name}</a></b><small>{s.email}</small></span>
              <span>{collegeName(s.college_id)}<small>{s.branch}, {s.year}</small></span>
              <span>
                {s.banned_at ? <span className="pill bad" title={s.ban_reason}>Banned {ago(s.banned_at)}</span>
                  : s.verified ? <span className="pill ok">Verified</span> : <span className="pill">Not verified</span>}
                <small>{s.banned_at ? s.ban_reason : s.verified ? `by ${VIA[s.verified_via || ""] || "—"}` : ""}</small>
              </span>
              <span>Joined {ago(s.created_at)}<small>{s.posts} posts{s.reports_against ? ` · ${s.reports_against} reports` : ""}</small></span>
              <span className="tact">
                {s.id !== me.id && (s.banned_at
                  ? <button className="btn small" onClick={() => run("admin_unban", { who: s.id }, `${s.name} unbanned.`)}>Unban</button>
                  : <>
                      {s.verified
                        ? s.verified_via !== "email" && <button className="btn small" onClick={() => run("admin_set_verified", { who: s.id, on_: false }, `Tick removed from ${s.name}.`)}>Remove tick</button>
                        : <button className="btn small" onClick={() => run("admin_set_verified", { who: s.id, on_: true }, `${s.name} is verified.`)}>Give tick</button>}
                      <button className="btn small bad" onClick={() => ban(s)}>Ban</button>
                    </>)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
