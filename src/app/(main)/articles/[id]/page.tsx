"use client";
import { useGate } from "@/components/Gate";
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AUTHOR_COLS, friendlyError, timeAgo } from "@/lib/format";
import { Markdown, readMinutes } from "@/lib/markdown";
import type { Article, ArticleComment } from "@/lib/types";
import { useApp } from "@/components/AppContext";
import { useToast } from "@/components/Toast";
import Avatar from "@/components/Avatar";
import Icon, { VerifiedTick } from "@/components/Icon";
import ReportSheet from "@/components/ReportSheet";
import Sheet from "@/components/Sheet";

export default function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me, collegeName, canAct } = useApp();
  const router = useRouter();
  const toast = useToast();
  const gate = useGate();
  const supabase = supabaseBrowser();
  const [a, setA] = useState<Article | null | undefined>(undefined);
  const [loadError, setLoadError] = useState("");
  const [likes, setLikes] = useState({ n: 0, mine: false });
  const [comments, setComments] = useState<ArticleComment[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<null | "report" | "delete">(null);
  const [reportComment, setReportComment] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    const { data } = await supabase.from("article_comments").select(`*, author:profiles!article_comments_author_id_fkey(${AUTHOR_COLS})`).eq("article_id", id).order("created_at").limit(300);
    setComments((data || []) as ArticleComment[]);
  }, [id, supabase]);

  const load = useCallback(async () => {
    setLoadError("");
    const { data, error } = await supabase.from("articles").select(`*, author:profiles!articles_author_id_fkey(${AUTHOR_COLS})`).eq("id", id).maybeSingle();
    if (error) { setLoadError(friendlyError(error, "Couldn't load this article.")); return; }
    setA((data as Article) || null);
    if (!data) return;
    const { data: l } = await supabase.from("likes").select("user_id").eq("item_type", "article").eq("item_id", id);
    const rows = (l || []) as { user_id: string }[];
    setLikes({ n: rows.length, mine: rows.some((r) => r.user_id === me.id) });
    loadComments();
  }, [id, supabase, me.id, loadComments]);

  useEffect(() => { load(); }, [load]);

  if (loadError) return <main className="wrap page"><div className="empty" style={{ marginTop: 20 }}>{loadError}<button className="secondary" onClick={load}>Try again</button></div></main>;
  if (a === undefined) return <main className="wrap page"><div className="reader"><span className="sk sk-line w40" /><span className="sk sk-title" /><span className="sk sk-line" /><span className="sk sk-line" /><span className="sk sk-line w70" /></div></main>;
  if (a === null) return <main className="wrap page"><div className="empty" style={{ marginTop: 20 }}>This article doesn&rsquo;t exist anymore, or it&rsquo;s only for students of another college.<Link className="secondary" href="/articles">See articles</Link></div></main>;

  const mine = a.author_id === me.id;
  const draft = a.status === "draft";

  async function toggleLike() {
    if (!gate("like articles")) return;
    const cur = likes;
    setLikes({ n: cur.n + (cur.mine ? -1 : 1), mine: !cur.mine });
    const res = cur.mine
      ? await supabase.from("likes").delete().match({ user_id: me.id, item_type: "article", item_id: id })
      : await supabase.from("likes").insert({ item_type: "article", item_id: id });
    if (res.error) { setLikes(cur); toast(friendlyError(res.error)); }
  }

  async function share() {
    const url = `${window.location.origin}/articles/${id}`;
    try {
      if (navigator.share) await navigator.share({ title: a!.title, text: a!.subtitle || a!.title, url });
      else { await navigator.clipboard.writeText(url); toast("Link copied"); }
    } catch { /* closed */ }
  }

  async function send() {
    const body = text.trim(); if (!body) return;
    setBusy(true);
    const { error } = await supabase.from("article_comments").insert({ article_id: id, body });
    setBusy(false);
    if (error) return toast(friendlyError(error, "Couldn't post your comment."));
    setText(""); loadComments();
  }

  async function removeComment(cid: string) {
    const { error } = await supabase.from("article_comments").delete().eq("id", cid);
    if (error) return toast(friendlyError(error));
    setComments((cs) => (cs || []).filter((c) => c.id !== cid));
  }

  async function del() {
    setBusy(true);
    const { error } = await supabase.from("articles").delete().eq("id", id);
    setBusy(false);
    if (error) return toast(friendlyError(error, "Couldn't delete the article."));
    toast("Article deleted");
    router.replace("/articles?tab=mine");
  }

  const when = a.published_at ? new Date(a.published_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

  return (
    <main className="wrap page">
      <div className="row" style={{ marginTop: 12, justifyContent: "space-between" }}>
        <Link href="/articles" className="ghost"><Icon name="back" size={16} /> Articles</Link>
        <div className="row" style={{ marginTop: 0 }}>
          {!draft && <button className="ghost" onClick={share}><Icon name="send" size={15} /> Share</button>}
          {!mine && <button className="ghost" onClick={() => setSheet("report")}><Icon name="flag" size={15} /> Report</button>}
        </div>
      </div>

      {draft && (
        <p className="warn" style={{ marginTop: 10 }}>This is a draft. Only you can see it.{" "}
          <Link href={`/articles/${a.id}/edit`} style={{ fontWeight: 700 }}>Keep writing</Link>
        </p>
      )}

      <article className="reader">
        <div className="reader-topic">{a.topic}{a.visibility === "college" ? ` · ${collegeName(a.college_id)} only` : ""}</div>
        <h1>{a.title}</h1>
        {a.subtitle && <p className="reader-sub">{a.subtitle}</p>}
        <div className="byline">
          <Link href={`/u/${a.author_id}`}><Avatar id={a.author_id} name={a.author?.name} /></Link>
          <div>
            <Link href={`/u/${a.author_id}`}><b>{a.author?.name || "Student"}</b></Link>{a.author?.verified && <VerifiedTick />}
            <span className="by-meta">{[collegeName(a.college_id), when, `${readMinutes(a.body)} min read`].filter(Boolean).join(" · ")}</span>
          </div>
        </div>
        <Markdown text={a.body} />
      </article>

      <div className="reader-acts">
        <button className={`ghost ${likes.mine ? "on" : ""}`} onClick={toggleLike} disabled={draft} aria-pressed={likes.mine}>
          <Icon name="heart" size={19} fill={likes.mine} /> {likes.n || ""} {likes.n === 1 ? "like" : "likes"}
        </button>
        <span className="ghost"><Icon name="msg" size={19} /> {comments?.length || 0}</span>
        {mine && (
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Link className="secondary" href={`/articles/${a.id}/edit`}><Icon name="pen" size={15} /> Edit</Link>
            <button className="secondary danger" onClick={() => setSheet("delete")}><Icon name="trash" size={15} /></button>
          </span>
        )}
      </div>

      {!draft && (
        <section>
          <div className="sec-head"><h2>Comments</h2>{comments && comments.length > 0 && <small>{comments.length}</small>}</div>
          {!canAct ? <p style={{ marginTop: 0 }}><a className="link-btn" href="/verify"><Icon name="lock" size={14} /> Verify to comment</a></p> : <div className="inline" style={{ marginBottom: 12 }}>
            <input value={text} maxLength={1000} placeholder="Add a comment" aria-label="Add a comment"
              onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
            <button onClick={send} disabled={busy || !text.trim()} aria-label="Send comment"><Icon name="send" size={16} /></button>
          </div>}
          {comments === null ? <p className="meta">Loading comments...</p> : comments.length === 0 ? <p className="meta">No comments yet. Say what you thought.</p> : (
            <div className="feed">
              {comments.map((c) => (
                <div key={c.id} className="post">
                  <Link href={`/u/${c.author_id}`}><Avatar id={c.author_id} name={c.author?.name} /></Link>
                  <div className="post-main">
                    <div className="post-meta">
                      <span className="post-who"><Link href={`/u/${c.author_id}`}><b>{c.author?.name || "Student"}</b></Link>{c.author?.verified && <VerifiedTick />}<span> · {timeAgo(c.created_at).replace(" ago", "")}</span></span>
                      {c.author_id === me.id || mine
                        ? <button className="ghost" aria-label="Delete comment" onClick={() => removeComment(c.id)}><Icon name="trash" size={14} /></button>
                        : <button className="ghost" aria-label="Report comment" onClick={() => setReportComment(c.id)}><Icon name="flag" size={14} /></button>}
                    </div>
                    <div className="body">{c.body}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {sheet === "report" && <ReportSheet targetType="article" targetId={a.id} onClose={() => setSheet(null)} />}
      {reportComment && <ReportSheet targetType="article_comment" targetId={reportComment} onClose={() => setReportComment(null)} />}
      {sheet === "delete" && (
        <Sheet title="Delete this article?" onClose={() => setSheet(null)}>
          <p className="note">This removes the article, its likes and comments for good. To hide it for now, open Edit and tap Unpublish.</p>
          <button className="primary" style={{ background: "var(--rose)" }} disabled={busy} onClick={del}>Delete for good</button>
        </Sheet>
      )}
    </main>
  );
}
