"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/format";
import { Markdown, plainText, readMinutes } from "@/lib/markdown";
import { ARTICLE_TOPICS, type Article } from "@/lib/types";
import { useApp } from "./AppContext";
import { useToast } from "./Toast";
import Icon from "./Icon";

const LOCAL_KEY = "den.articleDraft";
const MIN_CHARS = 100;

type Draft = { title: string; subtitle: string; body: string; topic: string; visibility: "india" | "college" };

/** Write or edit an article. New articles are also kept in this browser until saved, so nothing is lost. */
export default function ArticleEditor({ article }: { article?: Article }) {
  const { me, collegeName } = useApp();
  const router = useRouter();
  const toast = useToast();
  const supabase = supabaseBrowser();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [d, setD] = useState<Draft>(() => article
    ? { title: article.title, subtitle: article.subtitle, body: article.body, topic: article.topic, visibility: article.visibility }
    : { title: "", subtitle: "", body: "", topic: ARTICLE_TOPICS[0], visibility: "india" });
  const [view, setView] = useState<"write" | "preview">("write");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [dirty, setDirty] = useState(false);
  const published = article?.status === "published";

  // Bring back an unsaved new article from this browser.
  useEffect(() => {
    if (article) return;
    try {
      const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
      if (saved && (saved.title || saved.body)) { setD((x) => ({ ...x, ...saved })); toast("Restored your unsaved article"); }
    } catch { /* storage unavailable */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dirty) return;
    if (!article) { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(d)); } catch { /* ignore */ } }
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [d, dirty, article]);

  const set = (k: keyof Draft, v: string) => { setD((x) => ({ ...x, [k]: v })); setDirty(true); };

  // Wrap the selected text (or insert at the cursor) with formatting marks.
  function wrap(before: string, after = before, placeholder = "text") {
    const el = bodyRef.current; if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const sel = value.slice(a, b) || placeholder;
    const next = value.slice(0, a) + before + sel + after + value.slice(b);
    set("body", next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + before.length, a + before.length + sel.length); });
  }
  function linePrefix(prefix: string) {
    const el = bodyRef.current; if (!el) return;
    const { selectionStart: a, value } = el;
    const start = value.lastIndexOf("\n", a - 1) + 1;
    const next = value.slice(0, start) + prefix + value.slice(start);
    set("body", next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + prefix.length, a + prefix.length); });
  }
  function addLink() {
    const url = window.prompt("Paste the link (starting with https://)");
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) { toast("Links must start with https://"); return; }
    wrap("[", `](${url.trim()})`, "link text");
  }

  async function save(status: "draft" | "published") {
    setErr("");
    if (!d.title.trim()) return setErr("Give your article a title.");
    if (status === "published" && d.body.trim().length < MIN_CHARS) return setErr(`Write a little more before publishing (at least ${MIN_CHARS} characters).`);
    setBusy(true);
    const row = { title: d.title.trim(), subtitle: d.subtitle.trim(), body: d.body, topic: d.topic, visibility: d.visibility, status };
    const res = article
      ? await supabase.from("articles").update(row).eq("id", article.id).select("id").maybeSingle()
      : await supabase.from("articles").insert({ ...row, college_id: me.college_id }).select("id").single();
    setBusy(false);
    if (res.error) return setErr(friendlyError(res.error, "Couldn't save your article. Try again."));
    const id = (res.data as { id: string } | null)?.id;
    if (!id) return setErr("You can't edit this article anymore.");
    setDirty(false);
    if (!article) { try { localStorage.removeItem(LOCAL_KEY); } catch { /* ignore */ } }
    toast(status === "published" ? (published ? "Changes published" : "Published") : "Draft saved");
    if (status === "published") router.push(`/articles/${id}`);
    else if (!article) router.replace(`/articles/${id}/edit`);
  }

  const words = plainText(d.body).split(" ").filter(Boolean).length;

  return (
    <main className="wrap page editor">
      <div className="row editor-top">
        <Link href={article ? `/articles/${article.id}` : "/articles"} className="ghost"><Icon name="back" size={16} /> {article ? "Back" : "Articles"}</Link>
        <span className="meta">{article ? (published ? "Published" : "Draft") : "New article"}{dirty ? " · unsaved changes" : ""}</span>
      </div>

      {err && <p className="err" role="alert" style={{ marginTop: 8 }}>{err}</p>}

      <input className="ed-title" value={d.title} maxLength={150} onChange={(e) => set("title", e.target.value)} placeholder="Title" aria-label="Title" />
      <input className="ed-sub" value={d.subtitle} maxLength={220} onChange={(e) => set("subtitle", e.target.value)} placeholder="A one-line summary (optional)" aria-label="Summary" />

      <div className="ed-opts">
        <label><span>Topic</span>
          <select value={d.topic} onChange={(e) => set("topic", e.target.value)}>{ARTICLE_TOPICS.map((t) => <option key={t}>{t}</option>)}</select>
        </label>
        <label><span>Who can read it</span>
          <select value={d.visibility} onChange={(e) => set("visibility", e.target.value)}>
            <option value="india">Every college (All India)</option>
            <option value="college">Only {collegeName(me.college_id) || "my college"}</option>
          </select>
        </label>
      </div>

      <div className="ed-tabs" role="tablist">
        <button role="tab" aria-selected={view === "write"} className={view === "write" ? "on" : ""} onClick={() => setView("write")}>Write</button>
        <button role="tab" aria-selected={view === "preview"} className={view === "preview" ? "on" : ""} onClick={() => setView("preview")}>Preview</button>
        <span className="meta">{words} words · {readMinutes(d.body)} min read</span>
      </div>

      {view === "write" ? (
        <>
          <div className="ed-tools" role="toolbar" aria-label="Formatting">
            <button onClick={() => linePrefix("## ")} aria-label="Heading">H</button>
            <button onClick={() => wrap("**")} aria-label="Bold"><b>B</b></button>
            <button onClick={() => wrap("*")} aria-label="Italic"><i>I</i></button>
            <button onClick={() => linePrefix("- ")} aria-label="Bullet list">•</button>
            <button onClick={() => linePrefix("> ")} aria-label="Quote">&ldquo;</button>
            <button onClick={addLink} aria-label="Add link"><Icon name="link" size={16} /></button>
          </div>
          <textarea ref={bodyRef} className="ed-body" value={d.body} maxLength={40000} onChange={(e) => set("body", e.target.value)}
            placeholder={"Tell your story...\n\nTip: start a line with ## for a heading, - for a list, > for a quote. Wrap words in **double stars** for bold."} aria-label="Article text" />
        </>
      ) : (
        <article className="reader preview">
          <h1>{d.title || "Untitled"}</h1>
          {d.subtitle && <p className="reader-sub">{d.subtitle}</p>}
          {d.body.trim() ? <Markdown text={d.body} /> : <p className="meta">Nothing to preview yet.</p>}
        </article>
      )}

      <div className="ed-actions">
        {published ? (
          <>
            <button className="secondary" disabled={busy} onClick={() => save("draft")}>Unpublish</button>
            <button className="primary" disabled={busy} onClick={() => save("published")}>{busy ? "Saving..." : "Publish changes"}</button>
          </>
        ) : (
          <>
            <button className="secondary" disabled={busy} onClick={() => save("draft")}>Save draft</button>
            <button className="primary" disabled={busy} onClick={() => save("published")}>{busy ? "Publishing..." : "Publish"}</button>
          </>
        )}
      </div>
      <p className="note" style={{ marginTop: 10 }}>Follow the <Link href="/guidelines">community guidelines</Link>. Don&rsquo;t copy others&rsquo; writing without credit.</p>
    </main>
  );
}
