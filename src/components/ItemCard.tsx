"use client";
import { useState } from "react";
import Link from "next/link";
import { isUrl, rupees, timeAgo } from "@/lib/format";
import { SECTIONS, type SectionKey } from "@/lib/sections";
import type { AnyItem, CampusEvent, Listing, Note, Placement, Post } from "@/lib/types";
import { useApp } from "./AppContext";
import Icon, { VerifiedTick } from "./Icon";
import Comments from "./Comments";
import Avatar from "./Avatar";
import { MediaView } from "./Media";
import { useToast } from "./Toast";
import { shareLink } from "@/lib/share";

export interface CardActions {
  onLike?: () => void;
  onDelete: () => void;
  onReport: () => void;
  onToggleSold?: () => void;
}

export default function ItemCard({ type, item, likes, liked, showCollege, actions, openComments = false }: {
  type: SectionKey; item: AnyItem; likes: number; liked: boolean; showCollege: boolean; actions: CardActions;
  /** Start with the comments showing (the post's own page). */
  openComments?: boolean;
}) {
  const { me, collegeName } = useApp();
  const [confirm, setConfirm] = useState(false);
  const [open, setOpen] = useState(openComments);
  const toast = useToast();
  const [commentCount, setCommentCount] = useState<number>(
    type === "posts" ? ((item as Post).comments?.[0]?.count ?? 0) : 0,
  );
  const sec = SECTIONS[type];
  const a = item.author;
  const mine = item.author_id === me.id;

  const menuBtn = mine ? (
    confirm
      ? <button className="ghost danger" onClick={() => { setConfirm(false); actions.onDelete(); }}>Tap again to delete</button>
      : <button className="ghost" onClick={() => { setConfirm(true); setTimeout(() => setConfirm(false), 4000); }} aria-label="Delete"><Icon name={type === "posts" ? "more" : "trash"} size={type === "posts" ? 18 : 15} /></button>
  ) : (
    <button className="ghost" onClick={actions.onReport} aria-label="Report"><Icon name={type === "posts" ? "more" : "flag"} size={type === "posts" ? 18 : 15} /></button>
  );

  const who = (
    <div className="who">
      <div>
        <Link href={`/u/${item.author_id}`}><b>{a?.name || "Student"}</b>{a?.verified && <VerifiedTick />}</Link>
        {a?.branch ? `, ${a.branch}` : ""}{a?.year ? `, ${a.year}` : ""}
        {showCollege && collegeName(item.college_id) && <><br />{collegeName(item.college_id)}</>}
      </div>
      <div className="who-r">
        <span>{timeAgo(item.created_at)}</span>
        {menuBtn}
      </div>
    </div>
  );

  // Posts: a light row with no box, like a timeline.
  if (type === "posts") {
    const p = item as Post;
    return (
      <article className="post">
        <Link href={`/u/${item.author_id}`} aria-label={a?.name || "Student"}><Avatar id={item.author_id} name={a?.name} /></Link>
        <div className="post-main">
          <div className="post-meta">
            <span className="post-who">
              <Link href={`/u/${item.author_id}`}><b>{a?.name || "Student"}</b></Link>{a?.verified && <VerifiedTick />}
              {[a?.branch, a?.year?.replace(" year", " yr"), showCollege ? collegeName(item.college_id) : "", timeAgo(item.created_at).replace(" ago", "")].filter(Boolean).map((x) => <span key={x}> · {x}</span>)}
            </span>
            {menuBtn}
          </div>
          {p.kind && p.kind !== "General" && <span className={`kind-tag k-${p.kind.toLowerCase().replace(/[^a-z]+/g, "-")}`}>{p.kind}</span>}
          {p.body && <div className="body">{p.body}</div>}
          {!!p.media?.length && <MediaView items={p.media} className="post-media" />}
          <div className="post-acts">
            <button className={`ghost ${liked ? "on" : ""}`} onClick={actions.onLike} aria-pressed={liked} aria-label={`Like${likes ? `, ${likes}` : ""}`}>
              <Icon name="heart" size={17} fill={liked} /> {likes || ""}
            </button>
            <button className="ghost" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`Comments${commentCount ? `, ${commentCount}` : ""}`}>
              <Icon name="msg" size={17} /> {commentCount || ""}
            </button>
            <button className="ghost" aria-label="Share" onClick={async () => {
              const r = await shareLink(`${window.location.origin}/p/${item.id}`, `${a?.name || "A student"} on Den`, p.body?.slice(0, 120) || "");
              if (r === "copied") toast("Link copied. Paste it in WhatsApp or anywhere.");
              else if (r === "failed") toast("Couldn't share. Try again.");
            }}><Icon name="share" size={17} /></button>
            {!showCollege && p.visibility === "india" && <span className="post-scope" title="Shared with every college"><Icon name="globe" size={13} /> All India</span>}
          </div>
          {open && <Comments postId={item.id} onCount={setCommentCount} />}
        </div>
      </article>
    );
  }

  let body: React.ReactNode = null;
  if (type === "notes") {
    const n = item as Note;
    body = <>
      <span className="tag">{n.kind}</span>
      <div className="title">{n.title}</div>
      <div className="meta">{n.subject}, semester {n.semester}{n.branch ? `, ${n.branch}` : ""}</div>
      {!!n.media?.length && <MediaView items={n.media} />}
      {isUrl(n.link) && <a className="link-btn" href={n.link} target="_blank" rel="noopener noreferrer nofollow"><Icon name="link" size={15} /> Open notes</a>}
    </>;
  } else if (type === "placements") {
    const p = item as Placement;
    const cls = p.result === "Selected" ? "ok" : p.result === "Rejected" ? "no" : "wait";
    body = <>
      <span className={`tag ${cls}`}>{p.result}</span>
      <div className="title">{p.company}</div>
      <div className="meta">{p.role}{p.ctc ? `, ${p.ctc}` : ""}</div>
      <div className="label">Rounds</div><div className="body">{p.rounds}</div>
      {p.tips && <><div className="label">Tips</div><div className="body">{p.tips}</div></>}
    </>;
  } else if (type === "listings") {
    const l = item as Listing;
    body = <div className={l.sold ? "sold" : ""}>
      <span className="tag">{l.condition}</span>{l.sold && <span className="tag no">Sold</span>}
      <div className="title">{l.item}</div>
      <div className="price">{rupees(l.price)}</div>
      {!!l.media?.length && <MediaView items={l.media} />}
      {l.details && <div className="body">{l.details}</div>}
      <div className="meta">Contact: {l.contact}</div>
    </div>;
  } else if (type === "events") {
    const ev = item as CampusEvent;
    const d = new Date(ev.event_date + "T00:00:00");
    body = <div className="ev">
      <div className="stub"><b>{d.getDate()}</b><span>{d.toLocaleString("en-IN", { month: "short" })}</span></div>
      <div>
        <span className="tag">{ev.kind}</span>
        <div className="title">{ev.title}</div>
        {ev.venue && <div className="meta"><Icon name="pin" size={13} /> {ev.venue}</div>}
        {ev.details && <div className="body">{ev.details}</div>}
        {isUrl(ev.link) && <a className="link-btn" href={ev.link} target="_blank" rel="noopener noreferrer nofollow"><Icon name="link" size={15} /> Register</a>}
      </div>
    </div>;
  }

  return (
    <article className="card">
      {who}
      {body}
      <div className="row">
        {sec.likeLabel && actions.onLike && (
          <button className={`ghost ${liked ? "on" : ""}`} onClick={actions.onLike} aria-pressed={liked}>
            <Icon name="heart" size={16} fill={liked} /> {sec.likeLabel} {likes || ""}
          </button>
        )}
        {type === "listings" && !mine && (
          <Link className="secondary" href={`/u/${item.author_id}`}><Icon name="chat" size={15} /> Message seller</Link>
        )}
        {type === "listings" && mine && actions.onToggleSold && (
          <button className="secondary" onClick={actions.onToggleSold}>{(item as Listing).sold ? "Mark available" : "Mark sold"}</button>
        )}
      </div>
    </article>
  );
}
