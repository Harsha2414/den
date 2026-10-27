"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AUTHOR_COLS, friendlyError, timeAgo } from "@/lib/format";
import type { Comment } from "@/lib/types";
import { useApp } from "./AppContext";
import { useToast } from "./Toast";
import Icon, { VerifiedTick } from "./Icon";
import Avatar from "./Avatar";

export default function Comments({ postId, onCount }: { postId: string; onCount: (n: number) => void }) {
  const { me, canAct } = useApp();
  const toast = useToast();
  const supabase = supabaseBrowser();
  const [list, setList] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("comments").select(`*, author:profiles!comments_author_id_fkey(${AUTHOR_COLS})`).eq("post_id", postId).order("created_at").limit(200);
    const rows = (data || []) as Comment[];
    setList(rows); onCount(rows.length);
  }, [postId, supabase, onCount]);

  useEffect(() => { load(); }, [load]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    const { error } = await supabase.from("comments").insert({ post_id: postId, body });
    setBusy(false);
    if (error) return toast(friendlyError(error, "Couldn't post your comment."));
    setText(""); load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) return toast(friendlyError(error));
    load();
  }

  return (
    <div className="thread">
      {list === null ? <div className="meta">Loading comments...</div> :
        list.length === 0 ? <div className="meta">No comments yet.</div> :
        list.map((c) => (
          <div className="cmt" key={c.id}>
            <Link href={`/u/${c.author_id}`} className="cmt-av" aria-label={c.author?.name || "Student"}><Avatar id={c.author_id} name={c.author?.name} /></Link>
            <div className="cmt-main">
              <div className="cmt-head">
                <Link href={`/u/${c.author_id}`}><b>{c.author?.name || "Student"}</b></Link>{c.author?.verified && <VerifiedTick />}
                <span className="meta"> · {timeAgo(c.created_at).replace(" ago", "")}</span>
                {c.author_id === me.id && <button className="ghost cmt-del" onClick={() => remove(c.id)} aria-label="Delete comment"><Icon name="trash" size={13} /></button>}
              </div>
              <div className="cmt-body">{c.body}</div>
            </div>
          </div>
        ))}
      {!canAct ? <a className="link-btn" href="/verify" style={{ marginTop: 2 }}><Icon name="lock" size={14} /> Verify to comment</a> : <div className="inline">
        <input value={text} maxLength={1000} placeholder="Write a comment" aria-label="Write a comment"
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
        <button onClick={send} disabled={busy || !text.trim()} aria-label="Send comment"><Icon name="send" size={16} /></button>
      </div>}
    </div>
  );
}
