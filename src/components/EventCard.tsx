"use client";
import Link from "next/link";
import type { CampusEvent, RsvpStatus } from "@/lib/types";
import { isPast, timeLabel } from "@/lib/events";
import { useApp } from "./AppContext";
import Icon from "./Icon";

/** A tappable event in a list: date stub, title, time and place, how many are going, and your RSVP. */
export default function EventCard({ ev, going, mine, showCollege, organiser }: {
  ev: CampusEvent; going: number; mine?: RsvpStatus | null; showCollege?: boolean; organiser?: boolean;
}) {
  const { collegeName } = useApp();
  const d = new Date(ev.event_date + "T00:00:00");
  const past = isPast(ev);
  const full = !!ev.capacity && going >= ev.capacity;
  return (
    <Link href={`/events/${ev.id}`} className={`card ev-card ${ev.cancelled_at || past ? "dim" : ""}`}>
      <div className="ev">
        <div className="stub"><b>{d.getDate()}</b><span>{d.toLocaleString("en-IN", { month: "short" })}</span></div>
        <div>
          <div>
            {ev.cancelled_at ? <span className="tag no">Cancelled</span> : past ? <span className="tag">Over</span> : null}
            <span className="tag">{ev.kind}</span>
            {ev.tickets && <span className="tag wait">Ticket</span>}
            {organiser && <span className="tag ok">Organiser</span>}
          </div>
          <div className="title">{ev.title}</div>
          <div className="meta">
            {d.toLocaleDateString("en-IN", { weekday: "short" })}{ev.start_time ? `, ${timeLabel(ev.start_time)}` : ""}
            {ev.venue ? <> · <Icon name="pin" size={13} /> {ev.venue}</> : null}
          </div>
          {showCollege && collegeName(ev.college_id) && <div className="meta">{collegeName(ev.college_id)}</div>}
          <div className="ev-foot">
            <span className="meta"><Icon name="users" size={14} /> {going} going{ev.capacity ? ` of ${ev.capacity}` : ""}{full && !ev.cancelled_at ? " · Full" : ""}</span>
            {mine === "going" && <span className="you going"><Icon name="check" size={14} /> You&rsquo;re going</span>}
            {mine === "interested" && <span className="you">Interested</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}
