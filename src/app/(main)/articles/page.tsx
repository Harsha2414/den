"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AUTHOR_COLS, friendlyError, timeAgo } from "@/lib/format";
import { plainText, readMinutes } from "@/lib/markdown";
import { ARTICLE_TOPICS, type Article } from "@/lib/types";
import { useApp } from "@/components/AppContext";
import Avatar from "@/components/Avatar";
import Icon, { VerifiedTick } from "@/components/Icon";

type Tab = "india" | "college" | "mine";
const TABS: Record<Tab, string> = { india: "All India", college: "My college", mine: "Mine" };

export default function ArticlesPage() {
  const { me, collegeName, canAct } = useApp();
  const supabase = supabaseBrowser();
  const initial = useSearchParams().get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(initial && initial in TABS ? initial : "india");
  const [topic, setTopic] = useState<string>("");
  const [list, setList] = useState<Article[] | null>(null);
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError(""); setList(null);
    let q = supabase.from("articles").select(`id,author_id,college_id,visibility,topic,title,subtitle,body,status,published_at,created_at,updated_at, author:profiles!articles_author_id_fkey(${AUTHOR_COLS})`);
    if (tab === "mine") q = q.eq("author_id", me.id).order("updated_at", { ascending: false });
    else {
      q = q.eq("status", "published").order("published_at", { ascending: false });
      q = tab === "college" ? q.eq("college_id", me.college_id) : q.eq("visibility", "india");
    }
    if (topic) q = q.eq("topic", topic);
    const { data, error: err } = await q.limit(50);
    if (err) { setError(friendlyError(err, "Couldn't load articles.")); setList([]); return; }
    const rows = (data || []) as unknown as Article[];
    setList(rows);
    if (rows.length) {
      const { data: l } = await supabase.from("likes").select("item_id").eq("item_type", "article").in("item_id", rows.map((r) => r.id));
      const m: Record<string, number> = {};
      (l || []).forEach((x: { item_id: string }) => { m[x.item_id] = (m[x.item_id] || 0) + 1; });
      setLikes(m);
    }
  }, [tab, topic, me.id, me.college_id, supabase]);

  useEffect(() => { load(); }, [load]);

  return (
    <main className="wrap page">
      <div className="page-head">
        <h1>Articles</h1>
        <span>Long reads by students: campus life, careers, tech and more</span>
      </div>

      <div className="tabs" role="tablist">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{TABS[t]}</button>
        ))}
      </div>

      <div className="chips" role="group" aria-label="Topic">
        <button className={`chip ${!topic ? "on" : ""}`} onClick={() => setTopic("")}>All topics</button>
        {ARTICLE_TOPICS.map((t) => <button key={t} className={`chip ${topic === t ? "on" : ""}`} onClick={() => setTopic(topic === t ? "" : t)}>{t}</button>)}
      </div>

      {error && <p className="warn">{error}</p>}
      {list === null ? (
        <div className="feed" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="art-row skel"><span className="sk sk-line w40" /><span className="sk sk-title" /><span className="sk sk-line" /></div>)}</div>
      ) : list.length === 0 ? (
        <div className="empty" style={{ marginTop: 8 }}>
          {tab === "mine" ? "You haven't written anything yet. Your drafts and published articles show up here."
            : topic ? `No ${topic} articles yet.` : "No articles here yet. Be the first to write one."}
          <Link className="secondary" href="/articles/new"><Icon name="pen" size={15} /> Write an article</Link>
        </div>
      ) : (
        <div className="feed">
          {list.map((a) => (
            <Link key={a.id} href={a.status === "draft" ? `/articles/${a.id}/edit` : `/articles/${a.id}`} className="art-row">
              <div className="art-top">
                {a.status === "draft" && <span className="tag wait">Draft</span>}
                <span>{a.topic}</span><span>· {readMinutes(a.body)} min read</span>
                {a.visibility === "college" && <span>· Campus only</span>}
              </div>
              <h2>{a.title}</h2>
              <p>{a.subtitle || plainText(a.body).slice(0, 160)}</p>
              <div className="art-by">
                {tab !== "mine" && <><Avatar id={a.author_id} name={a.author?.name} /><b>{a.author?.name || "Student"}</b>{a.author?.verified && <VerifiedTick />}<span>· {collegeName(a.college_id)}</span></>}
                <span>{tab === "mine" ? `Edited ${timeAgo(a.updated_at)}` : `· ${timeAgo(a.published_at)}`}</span>
                {!!likes[a.id] && <span className="art-likes"><Icon name="heart" size={14} /> {likes[a.id]}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}

      <Link href={canAct ? "/articles/new" : "/verify"} className="fab" aria-label="Write an article"><Icon name="pen" size={22} /><span>Write</span></Link>
    </main>
  );
}
