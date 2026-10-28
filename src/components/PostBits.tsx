"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AUTHOR_COLS, friendlyError, timeAgo } from "@/lib/format";
import { REACTIONS, emojiOf, type Likes } from "@/lib/reactions";
import { fromStored, toStored } from "@/lib/mentions";
import type { Poll } from "@/lib/postExtras";
import type { Author } from "@/lib/types";
import Link from "next/link";
import RichText from "./RichText";
import MentionBox from "./MentionBox";
import Sheet from "./Sheet";
import Avatar from "./Avatar";
import Icon, { VerifiedTick } from "./Icon";
import { useToast } from "./Toast";

/** Post text, folded to 6 lines with "…more" (the post's own page shows it all). */
export function PostBody({ text, full }: { text: string; full?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(!!full);
  const [long, setLong] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !open) setLong(el.scrollHeight > el.clientHeight + 2);
  }, [text, open]);
  return (
    <>
      <div ref={ref} className={`body ${open ? "" : "clamp"}`}><RichText text={text} /></div>
      {long && !open && <button className="more-btn" onClick={() => setOpen(true)}>…more</button>}
    </>
  );
}

/** A poll: tap an option to vote; then everyone sees the totals (never who voted for what). */
export function PollView({ poll, onVote, canVote }: { poll: Poll; onVote: (choice: number) => void; canVote: boolean }) {
  const closed = !!poll.closes_at && new Date(poll.closes_at) < new Date();
  const showResults = poll.mine !== null || closed;
  return (
    <div className="poll" role="group" aria-label="Poll">
      {poll.options.map((o, i) => {
        const pct = poll.total ? Math.round((poll.counts[i] / poll.total) * 100) : 0;
        const mine = poll.mine === i;
        return (
          <button key={i} type="button" className={`poll-opt ${showResults ? "shown" : ""} ${mine ? "mine" : ""}`} disabled={closed || !canVote}
            onClick={() => onVote(i)} aria-pressed={mine} aria-label={showResults ? `${o}: ${pct}%${mine ? ", your vote" : ""}` : `Vote for ${o}`}>
            {showResults && <span className="poll-bar" style={{ width: `${pct}%` }} />}
            <span className="poll-label">{o}{mine && <Icon name="check" size={15} />}</span>
            {showResults && <span className="poll-pct">{pct}%</span>}
          </button>
        );
      })}
      <small className="poll-meta">
        {poll.total} vote{poll.total === 1 ? "" : "s"}
        {closed ? " · Poll closed" : poll.mine !== null ? " · Tap your choice again to take back your vote" : canVote ? " · Votes are anonymous" : ""}
      </small>
    </div>
  );
}

export type MenuActions = {
  mine: boolean; canEdit: boolean; isAdmin: boolean; pinned: boolean; authorName: string;
  onEdit: () => void; onDelete: () => void; onCopy: () => void; onHide: () => void; onMute: () => void; onReport: () => void; onPin: (pin: boolean) => void;
};

/** The ⋯ menu on a post. */
export function PostMenu({ a, onClose }: { a: MenuActions; onClose: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const run = (f: () => void) => () => { onClose(); f(); };
  return (
    <Sheet title="Post" onClose={onClose}>
      <div className="menu-list">
        {a.mine && a.canEdit && <button onClick={run(a.onEdit)}><Icon name="pen" size={18} /> Edit post<small>For the first 15 minutes</small></button>}
        <button onClick={run(a.onCopy)}><Icon name="link" size={18} /> Copy link</button>
        {a.isAdmin && <button onClick={run(() => a.onPin(!a.pinned))}><Icon name="pushpin" size={18} /> {a.pinned ? "Unpin from the top" : "Pin to the top of this college"}<small>Admins only. One pinned post per college.</small></button>}
        {!a.mine && <button onClick={run(a.onHide)}><Icon name="x" size={18} /> Hide this post<small>You won&rsquo;t see it again</small></button>}
        {!a.mine && <button onClick={run(a.onMute)}><Icon name="user" size={18} /> Mute {a.authorName}<small>Hide their posts. They won&rsquo;t know.</small></button>}
        {!a.mine && <button className="danger" onClick={run(a.onReport)}><Icon name="flag" size={18} /> Report</button>}
        {a.mine && (confirm
          ? <button className="danger" onClick={run(a.onDelete)}><Icon name="trash" size={18} /> Tap again to delete</button>
          : <button className="danger" onClick={() => setConfirm(true)}><Icon name="trash" size={18} /> Delete post</button>)}
      </div>
    </Sheet>
  );
}

/** Who reacted to a post, with a tab per reaction. */
export function WhoReacted({ postId, likes, onClose }: { postId: string; likes: Likes; onClose: () => void }) {
  const [rows, setRows] = useState<{ user_id: string; reaction: string; profile: Author | null }[] | null>(null);
  const [tab, setTab] = useState<string>("all");
  useEffect(() => {
    const supabase = supabaseBrowser();
    (async () => {
      let { data, error } = await supabase.from("likes").select(`user_id, reaction, profile:profiles!likes_user_id_fkey(${AUTHOR_COLS})`).eq("item_type", "post").eq("item_id", postId).order("created_at", { ascending: false }).limit(300);
      if (error) ({ data } = await supabase.from("likes").select(`user_id, profile:profiles!likes_user_id_fkey(${AUTHOR_COLS})`).eq("item_type", "post").eq("item_id", postId).limit(300));
      setRows(((data || []) as unknown as { user_id: string; reaction?: string; profile: Author | null }[]).map((r) => ({ ...r, reaction: r.reaction || "heart" })));
    })();
  }, [postId]);
  const tabs = REACTIONS.filter((r) => likes.counts[r.id]);
  const shown = (rows || []).filter((r) => tab === "all" || r.reaction === tab);
  return (
    <Sheet title="Reactions" onClose={onClose}>
      {tabs.length > 1 && (
        <div className="kind-chips who-tabs">
          <button aria-pressed={tab === "all"} onClick={() => setTab("all")}>All {likes.n}</button>
          {tabs.map((r) => <button key={r.id} aria-pressed={tab === r.id} onClick={() => setTab(r.id)}>{r.emoji} {likes.counts[r.id]}</button>)}
        </div>
      )}
      {rows === null ? <p className="meta">Loading…</p> : (
        <ul className="who-list">
          {shown.map((r) => (
            <li key={r.user_id}>
              <Link href={`/u/${r.user_id}`}><Avatar id={r.user_id} name={r.profile?.name} /></Link>
              <span><Link href={`/u/${r.user_id}`}><b>{r.profile?.name || "Student"}</b></Link>{r.profile?.verified && <VerifiedTick />}
                <small>{[r.profile?.branch, r.profile?.year].filter(Boolean).join(" · ")}</small></span>
              <span className="who-emoji">{emojiOf(r.reaction)}</span>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

/** Edit a post's text (first 15 minutes). */
export function EditPost({ postId, body, onClose, onSaved }: { postId: string; body: string; onClose: () => void; onSaved: (body: string) => void }) {
  const toast = useToast();
  const start = fromStored(body);
  const [text, setText] = useState(start.text);
  const [picked, setPicked] = useState(start.picked);
  const [busy, setBusy] = useState(false);
  async function save() {
    const next = toStored(text.trim(), picked);
    if (!next) return;
    setBusy(true);
    const { data, error } = await supabaseBrowser().from("posts").update({ body: next }).eq("id", postId).select("id").maybeSingle();
    setBusy(false);
    if (error) return toast(friendlyError(error, "Couldn't save your changes."));
    if (!data) return toast("This post can't be edited anymore.");
    toast("Saved");
    onSaved(next);
  }
  return (
    <Sheet title="Edit post" onClose={onClose}>
      <div className="form">
        <div className="field">
          <MentionBox multiline value={text} onChange={setText} picked={picked} onPick={(n, id) => setPicked((p) => ({ ...p, [n]: id }))} maxLength={3000} ariaLabel="Post text" />
          <small>Type @ to mention a classmate.</small>
        </div>
        <button className="primary" disabled={busy || !text.trim()} onClick={save}>{busy ? "Saving..." : "Save changes"}</button>
      </div>
    </Sheet>
  );
}

export const editedLabel = (iso?: string | null) => (iso ? `edited ${timeAgo(iso).replace(" ago", "")}` : "");
