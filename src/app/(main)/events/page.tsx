"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/format";
import { isPast } from "@/lib/events";
import type { CampusEvent, RsvpStatus } from "@/lib/types";
import { useApp } from "@/components/AppContext";
import EventCard from "@/components/EventCard";
import Icon from "@/components/Icon";

type Tab = "going" | "interested" | "organising";
const LABEL: Record<Tab, string> = { going: "Going", interested: "Interested", organising: "Organising" };
const EMPTY: Record<Tab, string> = {
  going: "You haven't said you're going to anything yet. Tap Going on an event and it shows up here with your ticket.",
  interested: "Events you mark as Interested show up here.",
  organising: "Events you create or co-organise show up here.",
};

export default function MyEventsPage() {
  const { me } = useApp();
  const supabase = supabaseBrowser();
  const [tab, setTab] = useState<Tab>("going");
  const [events, setEvents] = useState<Record<Tab, CampusEvent[]> | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const [r, own, co] = await Promise.all([
      supabase.from("event_rsvps").select("status, event:events(*)").eq("user_id", me.id),
      supabase.from("events").select("*").eq("author_id", me.id),
      supabase.from("event_organisers").select("event:events(*)").eq("user_id", me.id),
    ]);
    const err = r.error || own.error || co.error;
    if (err) { setError(friendlyError(err, "Couldn't load your events.")); setEvents({ going: [], interested: [], organising: [] }); return; }
    const rs = (r.data || []) as unknown as { status: RsvpStatus; event: CampusEvent | null }[];
    const organising = [...((own.data || []) as CampusEvent[]), ...((co.data || []) as unknown as { event: CampusEvent | null }[]).map((x) => x.event!).filter(Boolean)];
    const next = {
      going: rs.filter((x) => x.status === "going" && x.event).map((x) => x.event!),
      interested: rs.filter((x) => x.status === "interested" && x.event).map((x) => x.event!),
      organising,
    };
    setEvents(next);
    const ids = [...new Set([...next.going, ...next.interested, ...organising].map((e) => e.id))];
    if (ids.length) {
      const { data } = await supabase.from("event_rsvps").select("event_id").eq("status", "going").in("event_id", ids);
      const m: Record<string, number> = {};
      (data || []).forEach((x: { event_id: string }) => { m[x.event_id] = (m[x.event_id] || 0) + 1; });
      setCounts(m);
    }
  }, [me.id, supabase]);

  useEffect(() => { load(); }, [load]);

  const { upcoming, past } = useMemo(() => {
    const list = events?.[tab] || [];
    const up = list.filter((e) => !isPast(e)).sort((a, b) => (a.event_date + (a.start_time || "")).localeCompare(b.event_date + (b.start_time || "")));
    const old = list.filter((e) => isPast(e)).sort((a, b) => b.event_date.localeCompare(a.event_date));
    return { upcoming: up, past: old };
  }, [events, tab]);

  const card = (e: CampusEvent) => (
    <EventCard key={e.id} ev={e} going={counts[e.id] || 0} showCollege={e.college_id !== me.college_id}
      mine={tab === "organising" ? null : tab} organiser={tab === "organising"} />
  );

  return (
    <main className="wrap page">
      <div className="row" style={{ marginTop: 12 }}>
        <Link href={`/c/${me.college_id}?tab=events`} className="ghost"><Icon name="back" size={16} /> Events</Link>
      </div>
      <h1 className="title" style={{ fontSize: 28 }}>My events</h1>

      <div className="tabs" role="tablist">
        {(Object.keys(LABEL) as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>
            {LABEL[t]}{events && events[t].length ? ` ${events[t].length}` : ""}
          </button>
        ))}
      </div>

      {error && <p className="warn" style={{ marginTop: 12 }}>{error}</p>}
      {events === null ? <div className="empty" style={{ marginTop: 16 }}>Loading...</div> :
        upcoming.length + past.length === 0 ? (
          <div className="empty" style={{ marginTop: 16 }}>
            {EMPTY[tab]}
            <Link className="secondary" href={`/c/${me.college_id}?tab=events`}>{tab === "organising" ? "Create an event" : "Find events"}</Link>
          </div>
        ) : (
          <>
            <div className="sec-head"><h2>Upcoming</h2><small>{upcoming.length}</small></div>
            {upcoming.length === 0 ? <p className="meta">Nothing coming up.</p> : <div className="list">{upcoming.map(card)}</div>}
            {past.length > 0 && <>
              <div className="sec-head"><h2>Past</h2><small>{past.length}</small></div>
              <div className="list">{past.map(card)}</div>
            </>}
          </>
        )}
    </main>
  );
}
