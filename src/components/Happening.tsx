"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AUTHOR_COLS, timeAgo } from "@/lib/format";
import { timeLabel, todayIST } from "@/lib/events";
import { inviteMessage, whatsappLink } from "@/lib/share";
import type { Space } from "@/lib/types";
import { useApp } from "./AppContext";
import Icon from "./Icon";

type Ev = { id: string; title: string; kind: string; event_date: string; start_time: string | null; venue: string };
type Nt = { id: string; title: string; subject: string; kind: string; created_at: string };

/** Live Spaces, upcoming events and new notes for a college (or All India). */
function useHappening(scope: string) {
  const supabase = supabaseBrowser();
  const india = scope === "india";
  return useQuery({
    queryKey: ["happening", scope],
    staleTime: 60_000,
    queryFn: async () => {
      let live = supabase.from("spaces").select(`*, host:profiles!spaces_host_id_fkey(${AUTHOR_COLS})`).eq("status", "live");
      live = india ? live.eq("visibility", "india") : live.eq("college_id", scope);
      let ev = supabase.from("events").select("id,title,kind,event_date,start_time,venue").gte("event_date", todayIST()).is("cancelled_at", null);
      if (!india) ev = ev.eq("college_id", scope);
      let nt = supabase.from("notes").select("id,title,subject,kind,created_at");
      if (!india) nt = nt.eq("college_id", scope);
      const [l, e, n] = await Promise.all([
        live.order("started_at", { ascending: false }).limit(5),
        ev.order("event_date", { ascending: true }).limit(3),
        nt.order("created_at", { ascending: false }).limit(3),
      ]);
      return { live: (l.data || []) as Space[], events: (e.data || []) as Ev[], notes: (n.data || []) as Nt[] };
    },
  });
}

function dayLabel(d: string) {
  const t = todayIST();
  if (d === t) return "Today";
  const tomorrow = new Date(Date.parse(t + "T00:00:00Z") + 864e5).toISOString().slice(0, 10);
  if (d === tomorrow) return "Tomorrow";
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * "Happening at your college". On phones: a row of small cards to swipe, above the feed.
 * On wide screens: a column on the right of the feed (variant="rail").
 */
export default function Happening({ scope, variant }: { scope: string; variant: "strip" | "rail" }) {
  const { me, college } = useApp();
  const { data } = useHappening(scope);
  const india = scope === "india";
  const base = india ? "/india" : `/c/${scope}`;
  const name = india ? "All India" : college(scope)?.name;
  const live = data?.live || [], events = data?.events || [], notes = data?.notes || [];
  const empty = !live.length && !events.length && !notes.length;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const invite = (
    <a className="hap-invite" href={whatsappLink(inviteMessage(college(me.college_id)?.name, origin))} target="_blank" rel="noopener noreferrer">
      <Icon name="users" size={18} />
      <span><b>Invite classmates</b><small>Den is better with your whole batch. Send them a link on WhatsApp.</small></span>
    </a>
  );

  const liveCards = live.map((s) => (
    <Link key={s.id} href={`/spaces/${s.id}`} className="hap-card live">
      <span className="hap-kicker"><span className="tag live">LIVE</span> {s.mode === "debate" ? "Debate" : "Space"}</span>
      <b>{s.title}</b>
      <small>{s.host?.name || "A student"} · started {timeAgo(s.started_at)}</small>
      <span className="hap-go">Join</span>
    </Link>
  ));
  const eventCards = events.map((e) => (
    <Link key={e.id} href={`/events/${e.id}`} className="hap-card">
      <span className="hap-kicker"><Icon name="calendar" size={14} /> {dayLabel(e.event_date)}{e.start_time ? `, ${timeLabel(e.start_time)}` : ""}</span>
      <b>{e.title}</b>
      <small>{[e.kind, e.venue].filter(Boolean).join(" · ")}</small>
    </Link>
  ));
  const noteCards = notes.map((n) => (
    <Link key={n.id} href={`${base}?tab=notes`} className="hap-card">
      <span className="hap-kicker"><Icon name="file" size={14} /> New {n.kind === "PYQ" ? "PYQ" : n.kind.toLowerCase()}</span>
      <b>{n.title}</b>
      <small>{n.subject} · {timeAgo(n.created_at)}</small>
    </Link>
  ));

  if (variant === "strip") {
    if (!data || empty) return null;
    return (
      <section className="hap-strip" aria-label={`Happening at ${name}`}>
        <div className="hap-row">{liveCards}{eventCards}{noteCards}</div>
      </section>
    );
  }

  return (
    <aside className="hap-rail" aria-label={`Happening at ${name}`}>
      {live.length > 0 && <div className="hap-sec"><h2>Live now</h2>{liveCards}</div>}
      <div className="hap-sec">
        <div className="hap-h"><h2>Coming up</h2><Link href={`${base}?tab=events`}>All events</Link></div>
        {events.length ? eventCards : <p className="hap-none">{data ? "No events planned yet." : "Loading…"}</p>}
      </div>
      <div className="hap-sec">
        <div className="hap-h"><h2>New notes &amp; PYQs</h2><Link href={`${base}?tab=notes`}>All notes</Link></div>
        {notes.length ? noteCards : <p className="hap-none">{data ? "No notes shared yet." : "Loading…"}</p>}
      </div>
      {invite}
    </aside>
  );
}
