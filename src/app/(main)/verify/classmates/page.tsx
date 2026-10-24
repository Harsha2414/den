"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AUTHOR_COLS, friendlyError } from "@/lib/format";
import type { Author } from "@/lib/types";
import { useApp } from "@/components/AppContext";
import { useToast } from "@/components/Toast";
import Avatar from "@/components/Avatar";
import Icon, { VerifiedTick } from "@/components/Icon";

type V = { voucher_id: string; status: "pending" | "yes" | "no" | "unsure"; voucher: Author | null };

export default function ClassmatesPage() {
  const { me, collegeName } = useApp();
  const toast = useToast();
  const supabase = supabaseBrowser();
  const [mine, setMine] = useState<V[] | null>(null);
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Author[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("vouches").select(`voucher_id,status, voucher:profiles!vouches_voucher_id_fkey(${AUTHOR_COLS})`)
      .eq("requester_id", me.id).order("created_at");
    setMine((data || []) as unknown as V[]);
  }, [supabase, me.id]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const term = q.trim().replace(/[%_,()]/g, " ");
    const t = setTimeout(async () => {
      let query = supabase.from("profiles").select(AUTHOR_COLS).eq("college_id", me.college_id).eq("verified", true).neq("id", me.id);
      if (term) query = query.ilike("name", `%${term}%`);
      const { data } = await query.order("name").limit(20);
      setPeople((data || []) as Author[]);
    }, term ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, supabase, me.id, me.college_id]);

  async function ask(p: Author) {
    setBusy(p.id);
    const { error } = await supabase.rpc("request_vouch", { voucher: p.id });
    setBusy(null);
    if (error) return toast(friendlyError(error, "Couldn't send the request."));
    toast(`Asked ${p.name.split(" ")[0]}`);
    load();
  }
  async function cancel(v: V) {
    await supabase.from("vouches").delete().match({ requester_id: me.id, voucher_id: v.voucher_id });
    load();
  }

  const yes = (mine || []).filter((v) => v.status === "yes").length;
  const asked = new Set((mine || []).map((v) => v.voucher_id));
  const link = typeof window !== "undefined" ? `${window.location.origin}/vouch/${me.id}` : "";
  const wa = `https://wa.me/?text=${encodeURIComponent(`Hey! Can you confirm on Den that I study at ${collegeName(me.college_id)}? It takes 5 seconds: ${link}`)}`;

  if (me.verified) {
    return <main className="wrap page"><div className="empty" style={{ marginTop: 24 }}>You&rsquo;re already verified.<Link className="secondary" href={`/c/${me.college_id}`}>Go home</Link></div></main>;
  }

  return (
    <main className="wrap page">
      <div className="row" style={{ marginTop: 12 }}><Link href="/verify" className="ghost"><Icon name="back" size={16} /> Get verified</Link></div>
      <div className="page-head"><h1>{yes} of 2 confirmed</h1><span>{yes >= 1 ? "One more classmate and you're verified." : "Ask two verified classmates who know you in person."}</span></div>
      <div className="progress"><span style={{ width: `${Math.min(yes, 2) * 50}%` }} /></div>

      {mine && mine.length > 0 && <>
        <div className="side-label" style={{ padding: "16px 0 4px" }}>Your requests</div>
        {mine.map((v) => (
          <div key={v.voucher_id} className="pick">
            <Avatar id={v.voucher_id} name={v.voucher?.name} />
            <div><b>{v.voucher?.name || "Student"}{v.voucher?.verified && <VerifiedTick />}</b><span>{[v.voucher?.branch, v.voucher?.year].filter(Boolean).join(" · ")}</span></div>
            {v.status === "yes" ? <span className="state ok"><Icon name="check" size={14} /> Confirmed</span>
              : v.status === "pending" ? <button className="state wait" onClick={() => cancel(v)} title="Cancel request">Waiting · cancel</button>
              : <span className="state">Couldn&rsquo;t confirm</span>}
          </div>
        ))}
      </>}

      <div className="side-label" style={{ padding: "18px 0 6px" }}>Verified students at {collegeName(me.college_id)}</div>
      <div className="search"><Icon name="search" size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" aria-label="Search classmates" /></div>
      {people.length === 0 ? <p className="note">{q ? "No verified students by that name yet." : "No verified students from your college yet. Share the link below with friends who are on Den."}</p> :
        people.filter((p) => !asked.has(p.id)).map((p) => (
          <div key={p.id} className="pick">
            <Avatar id={p.id} name={p.name} />
            <div><b>{p.name}<VerifiedTick /></b><span>{[p.branch, p.year].filter(Boolean).join(" · ")}</span></div>
            <button className="secondary" disabled={busy === p.id} onClick={() => ask(p)}>Ask</button>
          </div>
        ))}

      <a className="primary wa" href={wa} target="_blank" rel="noopener noreferrer" style={{ marginTop: 18 }}><Icon name="send" /> Send a link on WhatsApp</a>
      <p className="note" style={{ textAlign: "center", marginTop: 8 }}>Ask people who know you in person. Only students verified for a week can vouch. Requests expire in 7 days.</p>
    </main>
  );
}
