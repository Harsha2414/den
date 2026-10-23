"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AUTHOR_COLS, friendlyError, timeAgo, whenLabel } from "@/lib/format";
import type { Space } from "@/lib/types";
import { useApp } from "@/components/AppContext";
import { useToast } from "@/components/Toast";
import Icon from "@/components/Icon";
import Sheet from "@/components/Sheet";
import Field from "@/components/Field";
import { primeRoom } from "@/lib/primedRoom";

type Filter = "all" | "space" | "debate";

function SpaceRow({ s }: { s: Space }) {
  const { collegeName } = useApp();
  return (
    <Link href={`/spaces/${s.id}`} className="card space-card" style={{ textDecoration: "none", display: "block" }}>
      <div className="row" style={{ marginTop: 0 }}>
        {s.status === "live" && <span className="tag live">LIVE</span>}
        {s.status === "scheduled" && <span className="tag wait">{s.scheduled_for ? whenLabel(s.scheduled_for) : "Starting soon"}</span>}
        {s.status === "ended" && <span className="tag">Ended</span>}
        <span className="tag">{s.mode === "debate" ? "Debate" : "Space"}</span>
        {s.visibility === "college" && <span className="tag ok">Campus only</span>}
      </div>
      <div className="title">{s.title}</div>
      {s.mode === "debate" && <div className="meta">{s.side_a} vs {s.side_b}</div>}
      {s.description && <div className="body" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.description}</div>}
      <div className="meta">
        Hosted by {s.host?.name || "a student"}{collegeName(s.college_id) ? `, ${collegeName(s.college_id)}` : ""}
        {s.status === "live" && s.started_at ? `. Started ${timeAgo(s.started_at)}` : ""}
      </div>
    </Link>
  );
}

export default function SpacesPage() {
  const { me } = useApp();
  const router = useRouter();
  const toast = useToast();
  const supabase = supabaseBrowser();
  const [filter, setFilter] = useState<Filter>("all");
  const [live, setLive] = useState<Space[] | null>(null);
  const [upcoming, setUpcoming] = useState<Space[]>([]);
  const [recent, setRecent] = useState<Space[]>([]);
  const [creating, setCreating] = useState(false);
  // Opened from "Start a Space or debate" in the menu.
  useEffect(() => { if (new URLSearchParams(window.location.search).get("new") === "1") setCreating(true); }, []);

  const load = useCallback(async () => {
    const sel = `*, host:profiles!spaces_host_id_fkey(${AUTHOR_COLS})`;
    const base = () => {
      const q = supabase.from("spaces").select(sel);
      return filter === "all" ? q : q.eq("mode", filter);
    };
    const [a, b, c] = await Promise.all([
      base().eq("status", "live").order("started_at", { ascending: false }).limit(30),
      base().eq("status", "scheduled").order("scheduled_for", { ascending: true, nullsFirst: false }).limit(30),
      base().eq("status", "ended").order("ended_at", { ascending: false }).limit(10),
    ]);
    setLive((a.data || []) as unknown as Space[]);
    setUpcoming((b.data || []) as unknown as Space[]);
    setRecent((c.data || []) as unknown as Space[]);
  }, [supabase, filter]);

  useEffect(() => {
    load();
    const ch = supabase.channel("spaces-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "spaces" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, supabase]);

  return (
    <main className="wrap page">
      <section className="banner" style={{ marginTop: 16 }}>
        <h1>Spaces</h1>
        <p>Live voice rooms for every campus. Host a talk, run an AMA with seniors, or settle it in a live debate.</p>
      </section>

      <div className="tabs" role="tablist">
        {(["all", "space", "debate"] as Filter[]).map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} className={`tab ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f === "space" ? "Spaces" : "Debates"}
          </button>
        ))}
      </div>

      <div className="sec-head"><h2>Live now</h2>{live && <small>{live.length}</small>}</div>
      {live === null ? <div className="empty">Loading...</div> :
        live.length === 0 ? <div className="empty">Nothing live right now. Start a Space and invite your batch.</div> :
        <div className="list">{live.map((s) => <SpaceRow key={s.id} s={s} />)}</div>}

      {upcoming.length > 0 && <>
        <div className="sec-head"><h2>Upcoming</h2><small>{upcoming.length}</small></div>
        <div className="list">{upcoming.map((s) => <SpaceRow key={s.id} s={s} />)}</div>
      </>}

      {recent.length > 0 && <>
        <div className="sec-head"><h2>Recently ended</h2></div>
        <div className="list">{recent.map((s) => <SpaceRow key={s.id} s={s} />)}</div>
      </>}

      <button className="fab" onClick={() => setCreating(true)}><Icon name="plus" /> Start a Space</button>
      {creating && <CreateSpace meCollege={me.college_id} onClose={() => setCreating(false)}
        onCreated={(id, live) => router.push(live ? `/spaces/${id}?join=1` : `/spaces/${id}`)} onError={(m) => toast(m)} />}
    </main>
  );
}

function CreateSpace({ meCollege, onClose, onCreated, onError }: {
  meCollege: string; onClose: () => void; onCreated: (id: string, live: boolean) => void; onError: (m: string) => void;
}) {
  const supabase = supabaseBrowser();
  const [mode, setMode] = useState<"space" | "debate">("space");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sideA, setSideA] = useState("For");
  const [sideB, setSideB] = useState("Against");
  const [visibility, setVisibility] = useState("All India");
  const [when, setWhen] = useState("Start now");
  const [at, setAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setErr(mode === "debate" ? "Add the debate question." : "Give your Space a title.");
    if (mode === "debate" && (!sideA.trim() || !sideB.trim())) return setErr("Name both sides of the debate.");
    let scheduled: string | null = null;
    if (when === "Schedule") {
      const d = new Date(at);
      if (!at || isNaN(d.getTime()) || d.getTime() < Date.now()) return setErr("Pick a start time in the future.");
      scheduled = d.toISOString();
    }
    // Unlock sound inside this tap so the host can go straight into the room.
    if (when === "Start now") primeRoom();
    setBusy(true); setErr("");
    const { data, error } = await supabase.from("spaces").insert({
      college_id: meCollege, title: title.trim(), description: description.trim(), mode,
      visibility: visibility === "All India" ? "india" : "college",
      side_a: sideA.trim() || "For", side_b: sideB.trim() || "Against", scheduled_for: scheduled,
    }).select("id").single();
    if (error) { setBusy(false); return setErr(friendlyError(error, "Couldn't create the Space.")); }
    const id = (data as { id: string }).id;
    let live = false;
    if (when === "Start now") {
      const res = await fetch(`/api/spaces/${id}/control`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start" }) });
      if (!res.ok) onError("Space created, but it couldn't go live. Open it and tap Go live.");
      else live = true;
    }
    onCreated(id, live);
  }

  return (
    <Sheet title="Start a Space" onClose={onClose}>
      <form className="form" onSubmit={create}>
        {err && <p className="err" role="alert">{err}</p>}
        <div className="vote" role="radiogroup" aria-label="Type" style={{ marginTop: 0 }}>
          <button type="button" role="radio" aria-checked={mode === "space"} className={`a ${mode === "space" ? "on" : ""}`} onClick={() => setMode("space")}>
            <span><Icon name="radio" size={22} /></span>Voice Space<br /><small className="meta">Host plus invited speakers</small>
          </button>
          <button type="button" role="radio" aria-checked={mode === "debate"} className={`b ${mode === "debate" ? "on" : ""}`} onClick={() => setMode("debate")}>
            <span><Icon name="scale" size={22} /></span>Live debate<br /><small className="meta">Two teams, timed turns, audience vote</small>
          </button>
        </div>
        <Field id="sp-title" f={{ key: "t", label: mode === "debate" ? "Debate question" : "Title", type: "text", required: true, max: 120,
          placeholder: mode === "debate" ? "Is a startup job better than a mass recruiter?" : "Placement AMA with final years" }} value={title} onChange={setTitle} />
        {mode === "debate" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field id="sp-a" f={{ key: "a", label: "Side A", type: "text", required: true, max: 60 }} value={sideA} onChange={setSideA} />
            <Field id="sp-b" f={{ key: "b", label: "Side B", type: "text", required: true, max: 60 }} value={sideB} onChange={setSideB} />
          </div>
        )}
        <Field id="sp-desc" f={{ key: "d", label: "Description", type: "textarea", max: 1000, placeholder: "What will you talk about? Who should join?" }} value={description} onChange={setDescription} />
        <Field id="sp-vis" f={{ key: "v", label: "Who can join", type: "select", options: ["All India", "My college"] }} value={visibility} onChange={setVisibility} />
        <Field id="sp-when" f={{ key: "w", label: "When", type: "select", options: ["Start now", "Schedule"] }} value={when} onChange={setWhen} />
        {when === "Schedule" && <Field id="sp-at" f={{ key: "at", label: "Start time", type: "datetime-local", required: true }} value={at} onChange={setAt} />}
        {mode === "debate" && <p className="note" style={{ margin: 0 }}>You'll moderate. Pick up to 3 debaters per side from the audience once people join. Rounds: openings (2 min each), rebuttals (90 s), audience questions (5 min), closings (1 min). The side that changes the most minds wins.</p>}
        <button className="primary" disabled={busy}>{busy ? "Creating..." : when === "Start now" ? "Go live" : "Schedule"}</button>
      </form>
    </Sheet>
  );
}
