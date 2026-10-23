"use client";
import { useGate } from "@/components/Gate";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/format";
import { isPast, todayIST } from "@/lib/events";
import Composer from "@/components/Composer";
import { useRouter } from "next/navigation";
import type { CampusEvent, RsvpStatus } from "@/lib/types";
import { useApp } from "@/components/AppContext";
import EventCard from "@/components/EventCard";
import Icon from "@/components/Icon";

type Tab = "upcoming" | "going" | "interested" | "organising";
const LABEL: Record<Tab, string> = { upcoming: "Upcoming", going: "Going", interested: "Interested", organising: "Organising" };
const EMPTY: Record<Tab, string> = {
  upcoming: "No upcoming events yet. Create your club's next fest, workshop or hackathon.",
  going: "You haven't said you're going to anything yet. Tap Going on an event and it shows up here with your ticket.",
  interested: "Events you mark as Interested show up here.",
  organising: "Events you create or co-organise show up here.",
};

export default function EventsPage() {
  const { me, collegeName } = useApp();
  const supabase = supabaseBrowser();
  const router = useRouter();
  const gate = useGate();
  const initial = useSearchParams().get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(initial && initial in LABEL ? initial : "upcoming");
  const [everywhere, setEverywhere] = useState(false);
  const [composing, setComposing] = useState(false);
  const [events, setEvents] = useState<Record<Tab, CampusEvent[]> | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    let up = supabase.from("events").select("*").gte("event_date", todayIST()).order("event_date").order("start_time", { nullsFirst: true }).limit(60);
    if (!everywhere) up = up.eq("college_id", me.college_id);
    const [u, r, own, co] = await Promise.all([
      up,
      supabase.from("event_rsvps").select("status, event:events(*)").eq("user_id", me.id),
      supabase.from("events").select("*").eq("author_id", me.id),
      supabase.from("event_organisers").select("event:events(*)").eq("user_id", me.id),
    ]);
    const err = u.error || r.error || own.error || co.error;
    if (err) { setError(friendlyError(err, "Couldn't load events.")); setEvents({ upcoming: [], going: [], interested: [], organising: [] }); return; }
    const rs = (r.data || []) as unknown as { status: RsvpStatus; event: CampusEvent | null }[];
    const organising = [...((own.data || []) as CampusEvent[]), ...((co.data || []) as unknown as { event: CampusEvent | null }[]).map((x) => x.event!).filter(Boolean)];
    const next: Record<Tab, CampusEvent[]> = {
      upcoming: (u.data || []) as CampusEvent[],
      going: rs.filter((x) => x.status === "going" && x.event).map((x) => x.event!),
      interested: rs.filter((x) => x.status === "interested" && x.event).map((x) => x.event!),
      organising,
    };
    setEvents(next);
    const ids = [...new Set([...next.upcoming, ...next.going, ...next.interested, ...organising].map((e) => e.id))];
    if (ids.length) {
      const { data } = await supabase.from("event_rsvps").select("event_id").eq("status", "going").in("event_id", ids);
      const m: Record<string, number> = {};
      (data || []).forEach((x: { event_id: string }) => { m[x.event_id] = (m[x.event_id] || 0) + 1; });
      setCounts(m);
    }
  }, [me.id, me.college_id, everywhere, supabase]);

  const myStatus = useMemo(() => {
    const m: Record<string, "going" | "interested"> = {};
    events?.going.forEach((e) => { m[e.id] = "going"; });
    events?.interested.forEach((e) => { m[e.id] = "interested"; });
    return m;
  }, [events]);

  useEffect(() => { load(); }, [load]);

  const { upcoming, past } = useMemo(() => {
    const list = events?.[tab] || [];
    const up = list.filter((e) => !isPast(e)).sort((a, b) => (a.event_date + (a.start_time || "")).localeCompare(b.event_date + (b.start_time || "")));
    const old = list.filter((e) => isPast(e)).sort((a, b) => b.event_date.localeCompare(a.event_date));
    return { upcoming: up, past: old };
  }, [events, tab]);

  const card = (e: CampusEvent) => (
    <EventCard key={e.id} ev={e} going={counts[e.id] || 0} showCollege={e.college_id !== me.college_id}
      mine={tab === "organising" ? null : tab === "upcoming" ? myStatus[e.id] : tab} organiser={tab === "organising" || e.author_id === me.id} />
  );

  return (
    <main className="wrap page">
      <div className="page-head">
        <h1>Events</h1>
        <span>{tab === "upcoming" ? (everywhere ? "All colleges" : collegeName(me.college_id)) : "Yours"}</span>
      </div>

      <div className="tabs" role="tablist">
        {(Object.keys(LABEL) as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>
            {LABEL[t]}{events && events[t].length ? ` ${events[t].length}` : ""}
          </button>
        ))}
      </div>

      {tab === "upcoming" && (
        <div className="chips">
          <button className={`chip ${!everywhere ? "on" : ""}`} onClick={() => setEverywhere(false)}>My college</button>
          <button className={`chip ${everywhere ? "on" : ""}`} onClick={() => setEverywhere(true)}>All colleges</button>
        </div>
      )}
      {error && <p className="warn" style={{ marginTop: 12 }}>{error}</p>}
      {events === null ? <div className="empty" style={{ marginTop: 16 }}>Loading...</div> :
        upcoming.length + past.length === 0 ? (
          <div className="empty" style={{ marginTop: 16 }}>
            {EMPTY[tab]}
            {tab === "upcoming" || tab === "organising"
              ? <button className="secondary" onClick={() => { if (gate("create events")) setComposing(true); }}>Create an event</button>
              : <button className="secondary" onClick={() => setTab("upcoming")}>Find events</button>}
          </div>
        ) : (
          <>
            {tab !== "upcoming" && <div className="sec-head"><h2>Upcoming</h2><small>{upcoming.length}</small></div>}
            {upcoming.length === 0 ? <p className="meta">Nothing coming up.</p> : <div className="list">{upcoming.map(card)}</div>}
            {past.length > 0 && <>
              <div className="sec-head"><h2>Past</h2><small>{past.length}</small></div>
              <div className="list">{past.map(card)}</div>
            </>}
          </>
        )}
      <button className="fab" onClick={() => { if (gate("create events")) setComposing(true); }} aria-label="Create an event"><Icon name="plus" size={24} /><span>Create an event</span></button>
      {composing && <Composer section="events" defaultIndia={false} onClose={() => setComposing(false)}
        onPosted={(id) => { setComposing(false); if (id) router.push(`/events/${id}`); }} />}
    </main>
  );
}
