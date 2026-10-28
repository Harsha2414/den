"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AUTHOR_COLS, friendlyError, timeAgo } from "@/lib/format";
import type { Comment } from "@/lib/types";
import { useApp } from "./AppContext";
import { useToast } from "./Toast";
import Icon, { VerifiedTick } from "./Icon";
import Avatar from "./Avatar";
import RichText from "./RichText";
import MentionBox from "./MentionBox";
import { toStored } from "@/lib/mentions";

/** Threads with more replies than this start folded ("View 5 more replies"). */
const SHOW_REPLIES = 2;

export default function Comments({ postId, onCount }: { postId: string; onCount: (n: number) => void }) {
  const { me, canAct } = useApp();
  const toast = useToast();
  const supabase = supabaseBrowser();
  const [list, setList] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [replying, setReplying] = useState<{ id: string; name: string } | null>(null);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const input = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const base = `*, author:profiles!comments_author_id_fkey(${AUTHOR_COLS})`;
    let { data, error } = await supabase.from("comments").select(`${base}, replied:profiles!comments_reply_to_fkey(id,name)`).eq("post_id", postId).order("created_at").limit(300);
    // Before migration 0012 there are no replies yet.
    if (error) ({ data } = await supabase.from("comments").select(base).eq("post_id", postId).order("created_at").limit(300));
    const rows = (data || []) as Comment[];
    setList(rows); onCount(rows.length);
  }, [postId, supabase, onCount]);

  useEffect(() => { load(); }, [load]);

  // Top-level comments, each with its replies underneath (oldest first).
  const threads = useMemo(() => {
    if (!list) return null;
    const ids = new Set(list.map((c) => c.id));
    const tops = list.filter((c) => !c.parent_id || !ids.has(c.parent_id));
    const replies = new Map<string, Comment[]>();
    for (const c of list) if (c.parent_id && ids.has(c.parent_id)) { const a = replies.get(c.parent_id) || []; a.push(c); replies.set(c.parent_id, a); }
    return tops.map((c) => ({ c, replies: replies.get(c.id) || [] }));
  }, [list]);

  function reply(c: Comment) {
    setReplying({ id: c.id, name: c.author?.name || "Student" });
    if (c.parent_id) setOpened((s) => new Set(s).add(c.parent_id!));
    setTimeout(() => input.current?.focus(), 30);
  }

  async function send() {
    const body = toStored(text.trim(), picked);
    if (!body) return;
    setBusy(true);
    const row = replying ? { post_id: postId, body, parent_id: replying.id } : { post_id: postId, body };
    const { error } = await supabase.from("comments").insert(row);
    setBusy(false);
    if (error) return toast(friendlyError(error, replying ? "Couldn't post your reply." : "Couldn't post your comment."));
    if (replying) { const top = list?.find((c) => c.id === replying.id); setOpened((s) => new Set(s).add(top?.parent_id || replying.id)); }
    setText(""); setPicked({}); setReplying(null); load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) return toast(friendlyError(error));
    load();
  }

  const one = (c: Comment, isReply: boolean) => (
    <div className={`cmt ${isReply ? "reply" : ""}`} key={c.id}>
      <Link href={`/u/${c.author_id}`} className="cmt-av" aria-label={c.author?.name || "Student"}><Avatar id={c.author_id} name={c.author?.name} /></Link>
      <div className="cmt-main">
        <div className="cmt-head">
          <Link href={`/u/${c.author_id}`}><b>{c.author?.name || "Student"}</b></Link>{c.author?.verified && <VerifiedTick />}
          <span className="meta"> · {timeAgo(c.created_at).replace(" ago", "")}</span>
          {c.author_id === me.id && <button className="ghost cmt-del" onClick={() => remove(c.id)} aria-label="Delete comment"><Icon name="trash" size={13} /></button>}
        </div>
        <div className="cmt-body">
          {isReply && c.replied?.name && <Link href={`/u/${c.reply_to}`} className="cmt-at">@{c.replied.name}</Link>}{isReply && c.replied?.name ? " " : ""}<RichText text={c.body} />
        </div>
        {canAct && <button className="cmt-reply" onClick={() => reply(c)}>Reply</button>}
      </div>
    </div>
  );

  return (
    <div className="thread">
      {threads === null ? <div className="meta">Loading comments...</div> :
        threads.length === 0 ? <div className="meta">No comments yet. Start the conversation.</div> :
        threads.map(({ c, replies }) => {
          const open = opened.has(c.id) || replies.length <= SHOW_REPLIES;
          const shown = open ? replies : replies.slice(-SHOW_REPLIES);
          return (
            <div className="cmt-thread" key={c.id}>
              {one(c, false)}
              {replies.length > 0 && (
                <div className="cmt-replies">
                  {!open && <button className="cmt-more" onClick={() => setOpened((s) => new Set(s).add(c.id))}>View {replies.length - SHOW_REPLIES} earlier repl{replies.length - SHOW_REPLIES === 1 ? "y" : "ies"}</button>}
                  {shown.map((r) => one(r, true))}
                </div>
              )}
            </div>
          );
        })}
      {!canAct ? <a className="link-btn" href="/verify" style={{ marginTop: 2 }}><Icon name="lock" size={14} /> Verify to comment</a> : <>
        {replying && (
          <div className="replying">Replying to <b>{replying.name}</b>
            <button className="ghost" aria-label="Cancel reply" onClick={() => setReplying(null)}><Icon name="x" size={14} /></button>
          </div>
        )}
        <div className="inline">
          <MentionBox ref={input} value={text} maxLength={1000} placeholder={replying ? `Reply to ${replying.name.split(" ")[0]}…` : "Write a comment"} ariaLabel={replying ? `Reply to ${replying.name}` : "Write a comment"}
            onChange={setText} picked={picked} onPick={(n, id) => setPicked((p) => ({ ...p, [n]: id }))} onEnter={send} onEscape={() => setReplying(null)} />
          <button onClick={send} disabled={busy || !text.trim()} aria-label={replying ? "Send reply" : "Send comment"}><Icon name="send" size={16} /></button>
        </div>
      </>}
    </div>
  );
}
