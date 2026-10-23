"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AUTHOR_COLS, friendlyError, timeAgo } from "@/lib/format";
import { downloadIcs, eventToValues, googleCalendarUrl, isPast, whenText } from "@/lib/events";
import type { Attendee, Author, CampusEvent, EventRsvp, EventUpdate, RsvpStatus } from "@/lib/types";
import { useApp } from "@/components/AppContext";
import { useToast } from "@/components/Toast";
import Avatar from "@/components/Avatar";
import Icon, { VerifiedTick } from "@/components/Icon";
import Composer from "@/components/Composer";
import PeoplePicker from "@/components/PeoplePicker";
import ReportSheet from "@/components/ReportSheet";
import Sheet from "@/components/Sheet";

type Organiser = { user_id: string; profile: Author | null };

function TicketQR({ code }: { code: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(code, { margin: 1, width: 360, errorCorrectionLevel: "M", color: { dark: "#172033", light: "#ffffff" } })
      .then(setSrc).catch(() => setSrc(""));
  }, [code]);
  return src ? <img src={src} alt={`Ticket QR code ${code}`} width={180} height={180} /> : <div style={{ width: 180, height: 180 }} />;
}

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me, collegeName } = useApp();
  const router = useRouter();
  const toast = useToast();
  const supabase = supabaseBrowser();

  const [ev, setEv] = useState<CampusEvent | null | undefined>(undefined);
  const [loadError, setLoadError] = useState("");
  const [organisers, setOrganisers] = useState<Organiser[]>([]);
  const [rsvps, setRsvps] = useState<EventRsvp[]>([]);
  const [updates, setUpdates] = useState<EventUpdate[]>([]);
  const [ticket, setTicket] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<null | "edit" | "going" | "guests" | "team" | "addTeam" | "cancel" | "delete" | "report">(null);
  const [updateText, setUpdateText] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [guests, setGuests] = useState<Attendee[] | null>(null);
  const [guestQuery, setGuestQuery] = useState("");

  const loadPeople = useCallback(async () => {
    const [r, t] = await Promise.all([
      supabase.from("event_rsvps").select(`event_id,user_id,status,created_at, profile:profiles!event_rsvps_user_id_fkey(${AUTHOR_COLS})`).eq("event_id", id).order("created_at"),
      supabase.rpc("my_ticket", { ev: id }),
    ]);
    setRsvps((r.data || []) as unknown as EventRsvp[]);
    setTicket((t.data as string | null) || null);
  }, [id, supabase]);

  const load = useCallback(async () => {
    setLoadError("");
    const { data, error } = await supabase.from("events").select(`*, author:profiles!events_author_id_fkey(${AUTHOR_COLS})`).eq("id", id).maybeSingle();
    if (error) { setLoadError(friendlyError(error, "Couldn't load this event.")); return; }
    setEv((data as CampusEvent) || null);
    if (!data) return;
    const [o, u] = await Promise.all([
      supabase.from("event_organisers").select(`user_id, profile:profiles!event_organisers_user_id_fkey(${AUTHOR_COLS})`).eq("event_id", id).order("added_at"),
      supabase.from("event_updates").select(`*, author:profiles!event_updates_author_id_fkey(${AUTHOR_COLS})`).eq("event_id", id).order("created_at", { ascending: false }),
      loadPeople(),
    ]);
    setOrganisers((o.data || []) as unknown as Organiser[]);
    setUpdates((u.data || []) as unknown as EventUpdate[]);
  }, [id, supabase, loadPeople]);

  useEffect(() => { load(); }, [load]);

  const going = useMemo(() => rsvps.filter((r) => r.status === "going"), [rsvps]);
  const interested = rsvps.length - going.length;
  const mine = rsvps.find((r) => r.user_id === me.id)?.status || null;

  if (loadError) return <main className="wrap page"><div className="empty" style={{ marginTop: 20 }}>{loadError}<button className="secondary" onClick={load}>Try again</button></div></main>;
  if (ev === undefined) return <main className="wrap page"><div className="empty" style={{ marginTop: 20 }}>Loading...</div></main>;
  if (ev === null) return <main className="wrap page"><div className="empty" style={{ marginTop: 20 }}>This event doesn&rsquo;t exist anymore.<Link className="secondary" href="/events">See events</Link></div></main>;

  const creator = ev.author_id === me.id;
  const isOrg = creator || organisers.some((o) => o.user_id === me.id);
  const past = isPast(ev);
  const open = !ev.cancelled_at && !past;
  const full = !!ev.capacity && going.length >= ev.capacity;
  const left = ev.capacity ? Math.max(0, ev.capacity - going.length) : null;
  const pageUrl = typeof window !== "undefined" ? `${window.location.origin}/events/${ev.id}` : "";

  async function rsvp(choice: RsvpStatus) {
    setBusy(true);
    const { error } = await supabase.rpc("rsvp_event", { ev: id, choice });
    setBusy(false);
    if (error) { toast(friendlyError(error, "Couldn't save that. Try again.")); return loadPeople(); }
    toast(choice === "going" ? (ev!.tickets ? "You're going. Your ticket is below." : "You're going") : "Marked as interested");
    loadPeople();
  }

  async function leave() {
    setBusy(true);
    const { error } = await supabase.from("event_rsvps").delete().match({ event_id: id, user_id: me.id });
    setBusy(false);
    if (error) return toast(friendlyError(error));
    toast(mine === "going" ? "You're no longer going" : "Removed");
    loadPeople();
  }

  async function postUpdate() {
    const body = updateText.trim();
    if (!body) return;
    setBusy(true);
    const { error } = await supabase.from("event_updates").insert({ event_id: id, body });
    setBusy(false);
    if (error) return toast(friendlyError(error, "Couldn't post the update."));
    setUpdateText("");
    toast("Update posted");
    load();
  }

  async function deleteUpdate(u: EventUpdate) {
    const { error } = await supabase.from("event_updates").delete().eq("id", u.id);
    if (error) return toast(friendlyError(error));
    setUpdates((xs) => xs.filter((x) => x.id !== u.id));
  }

  async function setCancelled(cancel: boolean) {
    setBusy(true);
    const { error } = await supabase.from("events").update({ cancelled_at: cancel ? new Date().toISOString() : null }).eq("id", id);
    if (!error && cancel) {
      const why = cancelReason.trim();
      await supabase.from("event_updates").insert({ event_id: id, body: `This event is cancelled.${why ? " " + why : ""}` });
    }
    setBusy(false);
    if (error) return toast(friendlyError(error));
    setSheet(null); setCancelReason("");
    toast(cancel ? "Event cancelled" : "Event is back on");
    load();
  }

  async function deleteEvent() {
    setBusy(true);
    const { error } = await supabase.from("events").delete().eq("id", id);
    setBusy(false);
    if (error) return toast(friendlyError(error, "Couldn't delete the event."));
    toast("Event deleted");
    router.replace("/events");
  }

  async function openGuests() {
    setSheet("guests"); setGuests(null); setGuestQuery("");
    const { data, error } = await supabase.rpc("event_attendees", { ev: id });
    if (error) { toast(friendlyError(error)); setSheet(null); return; }
    setGuests((data || []) as Attendee[]);
  }

  async function setCheckIn(who: Attendee, done: boolean) {
    const { error } = await supabase.rpc("set_check_in", { ev: id, who: who.user_id, done });
    if (error) return toast(friendlyError(error));
    setGuests((gs) => (gs || []).map((g) => g.user_id === who.user_id ? { ...g, checked_in_at: done ? new Date().toISOString() : null } : g));
  }

  function exportGuests() {
    if (!guests) return;
    const esc = (v: string) => `"${(v || "").replace(/"/g, '""')}"`;
    const rows = [["Name", "College", "Branch", "Year", "Status", "Checked in"],
      ...guests.map((g) => [g.name, collegeName(g.college_id), g.branch, g.year, g.status, g.checked_in_at ? new Date(g.checked_in_at).toLocaleString("en-IN") : ""])];
    const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${ev!.title.replace(/[^\w\s-]/g, "").trim().slice(0, 40) || "event"} guests.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  async function addOrganiser(p: Author) {
    const { error } = await supabase.rpc("add_event_organiser", { ev: id, who: p.id });
    if (error) return toast(friendlyError(error));
    toast(`${p.name} can now manage this event`);
    setSheet("team"); load();
  }

  async function removeOrganiser(uid: string) {
    const { error } = await supabase.rpc("remove_event_organiser", { ev: id, who: uid });
    if (error) return toast(friendlyError(error));
    if (uid === me.id) { toast("You're no longer an organiser"); setSheet(null); }
    load();
  }

  async function share() {
    const data = { title: ev!.title, text: `${ev!.title} · ${whenText(ev!)}`, url: pageUrl };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(pageUrl); toast("Link copied"); }
    } catch { /* closed the share sheet */ }
  }

  const checkedIn = guests?.filter((g) => g.checked_in_at).length || 0;
  const shownGuests = (guests || []).filter((g) => !guestQuery.trim() || g.name.toLowerCase().includes(guestQuery.trim().toLowerCase()));
  const teamNames = organisers.map((o) => o.profile?.name).filter(Boolean);

  return (
    <main className="wrap page">
      <div className="row" style={{ marginTop: 12, justifyContent: "space-between" }}>
        <Link href="/events" className="ghost"><Icon name="back" size={16} /> Events</Link>
        <div className="row" style={{ marginTop: 0 }}>
          <button className="ghost" onClick={share}><Icon name="send" size={15} /> Share</button>
          {!isOrg && <button className="ghost" onClick={() => setSheet("report")}><Icon name="flag" size={15} /> Report</button>}
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        {ev.cancelled_at && <span className="tag no">Cancelled</span>}
        {past && !ev.cancelled_at && <span className="tag">Over</span>}
        <span className="tag">{ev.kind}</span>
        {ev.tickets && <span className="tag wait">Free ticket</span>}
      </div>
      <h1 className="title" style={{ fontSize: 28 }}>{ev.title}</h1>

      <ul className="ev-facts">
        <li><Icon name="clock" size={18} /><span>{whenText(ev)}</span></li>
        {ev.venue && <li><Icon name="pin" size={18} /><span>{ev.venue}</span></li>}
        <li><Icon name="cap" size={18} /><span>{collegeName(ev.college_id) || "College"}</span></li>
        <li><Icon name="user" size={18} /><span>
          By <Link href={`/u/${ev.author_id}`}>{ev.author?.name || "a student"}</Link>{ev.author?.verified && <VerifiedTick />}
          {teamNames.length > 0 && <> with {teamNames.join(", ")}</>}
        </span></li>
      </ul>

      <button className="going-line" onClick={() => setSheet("going")}>
        <span className="faces">{going.slice(0, 4).map((r) => <Avatar key={r.user_id} id={r.user_id} name={r.profile?.name || "S"} />)}</span>
        <span><b>{going.length} going</b>{interested ? ` · ${interested} interested` : ""}
          {left !== null && open && <span className={left === 0 ? "full" : ""}> · {left === 0 ? "Full" : `${left} ${left === 1 ? "seat" : "seats"} left`}</span>}
        </span>
        <Icon name="more" size={18} />
      </button>

      {open && (
        <div className="rsvp" role="group" aria-label="Your RSVP">
          <button className={mine === "going" ? "on" : ""} disabled={busy || (full && mine !== "going")} onClick={() => mine === "going" ? null : rsvp("going")} aria-pressed={mine === "going"}>
            <Icon name="check" size={17} /> {mine === "going" ? "Going" : full ? "Full" : "Going"}
          </button>
          <button className={mine === "interested" ? "on" : ""} disabled={busy} onClick={() => mine === "interested" ? null : rsvp("interested")} aria-pressed={mine === "interested"}>
            <Icon name="heart" size={17} fill={mine === "interested"} /> Interested
          </button>
        </div>
      )}
      {open && mine && <button className="ghost" style={{ marginTop: 6 }} disabled={busy} onClick={leave}>{mine === "going" ? "Can't go anymore" : "Not interested"}</button>}

      {ev.tickets && mine === "going" && ticket && !ev.cancelled_at && (
        <section className="ticket">
          <TicketQR code={ticket} />
          <div>
            <b>Your ticket</b>
            <div className="code">{ticket.slice(0, 5)} {ticket.slice(5)}</div>
            <p className="meta">Show this at the door. Organisers scan it to check you in. Screenshots work too.</p>
          </div>
        </section>
      )}

      {open && (
        <div className="row">
          <a className="secondary" href={googleCalendarUrl(ev, pageUrl)} target="_blank" rel="noopener noreferrer"><Icon name="clock" size={15} /> Google Calendar</a>
          <button className="secondary" onClick={() => downloadIcs(ev, pageUrl)}><Icon name="plus" size={15} /> Apple / Outlook</button>
        </div>
      )}

      {ev.link && /^https?:\/\//i.test(ev.link) && (
        <a className="link-btn" href={ev.link} target="_blank" rel="noopener noreferrer nofollow"><Icon name="link" size={15} /> Organiser&rsquo;s registration page</a>
      )}

      {ev.details && <><div className="sec-head"><h2>About</h2></div><p className="body" style={{ whiteSpace: "pre-wrap" }}>{ev.details}</p></>}

      {isOrg && (
        <section className="org-panel">
          <div className="sec-head" style={{ marginTop: 0 }}><h2>Manage</h2><small>Only organisers see this</small></div>
          <div className="org-grid">
            <button onClick={openGuests}><Icon name="users" /> Guest list</button>
            {ev.tickets && <Link href={`/events/${ev.id}/scan`}><Icon name="check" /> Scan tickets</Link>}
            <button onClick={() => setSheet("edit")}><Icon name="book" /> Edit details</button>
            <button onClick={() => setSheet("team")}><Icon name="user" /> Co-organisers</button>
          </div>
          {!past && (
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="ev-update">Post an update to everyone</label>
              <textarea id="ev-update" value={updateText} maxLength={1000} onChange={(e) => setUpdateText(e.target.value)} placeholder="Venue moved to LH-2, bring your ID card..." />
              <button className="secondary" style={{ alignSelf: "flex-start", marginTop: 8 }} disabled={busy || !updateText.trim()} onClick={postUpdate}><Icon name="send" size={15} /> Post update</button>
            </div>
          )}
          <div className="row">
            {ev.cancelled_at
              ? (!past && <button className="secondary" onClick={() => setCancelled(false)} disabled={busy}>Undo cancel</button>)
              : !past && <button className="secondary danger" onClick={() => setSheet("cancel")}>Cancel event</button>}
            {creator && <button className="ghost danger" onClick={() => setSheet("delete")}><Icon name="trash" size={15} /> Delete</button>}
          </div>
        </section>
      )}

      <div className="sec-head"><h2>Updates</h2>{updates.length > 0 && <small>{updates.length}</small>}</div>
      {updates.length === 0 ? <p className="meta">No updates yet. Organisers post changes here.</p> : (
        <div className="list">
          {updates.map((u) => (
            <article key={u.id} className="card">
              <div className="who">
                <div><b>{u.author?.name || "Organiser"}</b> · organiser</div>
                <div className="who-r"><span>{timeAgo(u.created_at)}</span>
                  {u.author_id === me.id && <button className="ghost" aria-label="Delete update" onClick={() => deleteUpdate(u)}><Icon name="trash" size={15} /></button>}
                </div>
              </div>
              <div className="body" style={{ whiteSpace: "pre-wrap" }}>{u.body}</div>
            </article>
          ))}
        </div>
      )}

      {sheet === "edit" && (
        <Composer section="events" defaultIndia={false} editId={ev.id} initial={eventToValues(ev)}
          onClose={() => setSheet(null)} onPosted={() => { setSheet(null); load(); }} />
      )}

      {sheet === "going" && (
        <Sheet title={`${going.length} going`} onClose={() => setSheet(null)}>
          {going.length === 0 ? <p className="note">Nobody yet. Be the first.</p> : going.map((r) => (
            <Link key={r.user_id} href={`/u/${r.user_id}`} className="pick">
              <Avatar id={r.user_id} name={r.profile?.name || "S"} />
              <div><b>{r.profile?.name || "Student"}{r.profile?.verified && <VerifiedTick />}</b>
                <span>{[r.profile?.branch, r.profile?.year, collegeName(r.profile?.college_id)].filter(Boolean).join(", ")}</span></div>
            </Link>
          ))}
          {interested > 0 && <p className="note" style={{ marginTop: 12 }}>{interested} more {interested === 1 ? "is" : "are"} interested.</p>}
        </Sheet>
      )}

      {sheet === "guests" && (
        <Sheet title="Guest list" onClose={() => setSheet(null)}>
          {guests === null ? <p className="meta">Loading...</p> : (
            <>
              <div className="stats-row">
                <div><b>{guests.filter((g) => g.status === "going").length}</b>going</div>
                <div><b>{checkedIn}</b>checked in</div>
                <div><b>{guests.filter((g) => g.status === "interested").length}</b>interested</div>
              </div>
              <div className="row" style={{ marginBottom: 10 }}>
                {ev.tickets && <Link className="secondary" href={`/events/${ev.id}/scan`}><Icon name="check" size={15} /> Scan tickets</Link>}
                <button className="secondary" onClick={exportGuests} disabled={!guests.length}>Download list (CSV)</button>
              </div>
              <div className="search"><Icon name="search" size={17} /><input value={guestQuery} onChange={(e) => setGuestQuery(e.target.value)} placeholder="Search guests" aria-label="Search guests" /></div>
              {shownGuests.length === 0 ? <p className="note">{guests.length ? "No one by that name." : "No one has RSVP'd yet."}</p> : shownGuests.map((g) => (
                <div key={g.user_id} className="pick">
                  <Avatar id={g.user_id} name={g.name} />
                  <div style={{ flex: 1, minWidth: 0 }}><b>{g.name}{g.verified && <VerifiedTick />}</b>
                    <span>{g.status === "going" ? (g.checked_in_at ? `Checked in ${timeAgo(g.checked_in_at)}` : "Going") : "Interested"} · {[g.branch, g.year].filter(Boolean).join(", ")}</span></div>
                  {g.status === "going" && (g.checked_in_at
                    ? <button className="ghost" onClick={() => setCheckIn(g, false)}>Undo</button>
                    : <button className="secondary" onClick={() => setCheckIn(g, true)}>Check in</button>)}
                </div>
              ))}
            </>
          )}
        </Sheet>
      )}

      {sheet === "team" && (
        <Sheet title="Co-organisers" onClose={() => setSheet(null)}>
          <p className="note">Co-organisers can edit the event, post updates, see the guest list and scan tickets. Only you, the creator, can add or remove them or delete the event.</p>
          <div className="pick">
            <Avatar id={ev.author_id} name={ev.author?.name || "S"} />
            <div style={{ flex: 1 }}><b>{ev.author?.name || "Creator"}</b><span>Creator</span></div>
          </div>
          {organisers.map((o) => (
            <div key={o.user_id} className="pick">
              <Avatar id={o.user_id} name={o.profile?.name || "S"} />
              <div style={{ flex: 1 }}><b>{o.profile?.name || "Student"}</b><span>Co-organiser</span></div>
              {(creator || o.user_id === me.id) && <button className="ghost danger" onClick={() => removeOrganiser(o.user_id)}>{o.user_id === me.id ? "Leave" : "Remove"}</button>}
            </div>
          ))}
          {creator && <button className="primary" style={{ marginTop: 14 }} onClick={() => setSheet("addTeam")}><Icon name="plus" /> Add a co-organiser</button>}
        </Sheet>
      )}

      {sheet === "addTeam" && (
        <Sheet title="Add a co-organiser" onClose={() => setSheet("team")}>
          <PeoplePicker onPick={addOrganiser} />
        </Sheet>
      )}

      {sheet === "cancel" && (
        <Sheet title="Cancel this event?" onClose={() => setSheet(null)}>
          <p className="note">Everyone who RSVP&rsquo;d sees it as cancelled, and new RSVPs stop. You can undo this later.</p>
          <div className="field">
            <label htmlFor="cancel-why">Tell attendees why (optional)</label>
            <textarea id="cancel-why" value={cancelReason} maxLength={900} onChange={(e) => setCancelReason(e.target.value)} placeholder="Postponed because of exams. New date soon." />
          </div>
          <button className="primary" style={{ marginTop: 12, background: "var(--rose)" }} disabled={busy} onClick={() => setCancelled(true)}>Cancel event</button>
        </Sheet>
      )}

      {sheet === "delete" && (
        <Sheet title="Delete this event?" onClose={() => setSheet(null)}>
          <p className="note">This removes the event, its updates, the guest list and all tickets for good. To keep a record, cancel it instead.</p>
          <button className="primary" style={{ background: "var(--rose)" }} disabled={busy} onClick={deleteEvent}>Delete for good</button>
        </Sheet>
      )}

      {sheet === "report" && <ReportSheet targetType="event" targetId={ev.id} onClose={() => setSheet(null)} />}
    </main>
  );
}
