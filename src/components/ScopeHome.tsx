"use client";
import { useGate, VerifyBanner, VouchInbox } from "./Gate";
import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Virtuoso } from "react-virtuoso";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AUTHOR_COLS, friendlyError, timeAgo } from "@/lib/format";
import { LIKE_TYPE_OF, REPORT_TYPE_OF, SECTIONS, type SectionKey } from "@/lib/sections";
import type { AnyItem, CampusEvent, RsvpStatus, Space } from "@/lib/types";
import { todayIST } from "@/lib/events";
import { useApp } from "./AppContext";
import { useToast } from "./Toast";
import Icon from "./Icon";
import ItemCard from "./ItemCard";
import EventCard from "./EventCard";
import Composer from "./Composer";
import ReportSheet from "./ReportSheet";
import Avatar from "./Avatar";
import Happening from "./Happening";
import { inviteMessage, whatsappLink } from "@/lib/share";
import { groupLikes, nextLikes, NO_LIKES, type Likes } from "@/lib/reactions";
import { loadExtras, loadFilters, nextPoll, type Poll } from "@/lib/postExtras";
import { usePullToRefresh } from "@/lib/pullToRefresh";

const INDIA_TABS: SectionKey[] = ["posts", "notes", "placements", "events"];
const COLLEGE_TABS: SectionKey[] = ["posts", "notes", "placements", "listings", "events"];

const PAGE = 20;

const TITLES: Record<SectionKey, string> = { posts: "Feed", notes: "Notes & PYQs", placements: "Placements", listings: "Market", events: "Events" };

/** Filter chips for the feed (posts already have these types). */
const KINDS = [
  { id: "", label: "All" },
  { id: "Doubt", label: "Doubts" },
  { id: "Announcement", label: "Announcements" },
  { id: "Lost & found", label: "Lost & found" },
  { id: "Hostel life", label: "Hostel life" },
] as const;
const KIND_EMPTY: Record<string, string> = {
  Doubt: "No doubts asked here yet.", Announcement: "No announcements here yet.",
  "Lost & found": "Nothing lost or found here yet.", "Hostel life": "No hostel life posts here yet.",
};
/** How often to check for posts that arrived while reading. */
const NEW_POSTS_EVERY = 40_000;

/** Midnight today in India, as a timestamp (for "posts today"). */
const startOfTodayIST = () => new Date(Date.parse(todayIST() + "T00:00:00+05:30")).toISOString();

export default function ScopeHome({ scope, initialTab, startComposing }: { scope: string; initialTab?: string; startComposing?: boolean }) {
  const { me, college } = useApp();
  const toast = useToast();
  const gate = useGate();
  const router = useRouter();
  const supabase = supabaseBrowser();
  const india = scope === "india";
  const sc = college(scope);
  const isMine = scope === me.college_id;
  const tabs = india ? INDIA_TABS : COLLEGE_TABS;
  const [tab] = useState<SectionKey>(tabs.includes(initialTab as SectionKey) ? (initialTab as SectionKey) : "posts");
  const [searching, setSearching] = useState(false);
  const [likeOver, setLikeOver] = useState<Record<string, Likes>>({});
  const [savedOver, setSavedOver] = useState<Record<string, boolean>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [patched, setPatched] = useState<Record<string, Partial<AnyItem>>>({});
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [sort, setSort] = useState<"latest" | "top">("latest");
  const [pollOver, setPollOver] = useState<Record<string, Poll>>({});
  const { canAct } = useApp();
  const [composing, setComposing] = useState(!!startComposing && canAct && (scope === me.college_id || scope === "india"));
  const [reporting, setReporting] = useState<string | null>(null);
  const qc = useQueryClient();
  const key = ["scope", scope, tab, kind, sort] as const;

  // People you muted and posts you hid (posts only; loaded once).
  const filtersQ = useQuery({ queryKey: ["feed-filters", me.id], enabled: tab === "posts", staleTime: 5 * 60_000, queryFn: () => loadFilters(supabase) });
  const filters = filtersQ.data;

  type Page = { rows: AnyItem[]; likes: Record<string, Likes>; saved: string[]; polls: Record<string, Poll>; rsvps: Record<string, { going: number; mine: RsvpStatus | null }> };
  const feed = useInfiniteQuery({
    queryKey: key,
    initialPageParam: 0,
    // Hidden or muted posts are dropped after loading, so "full" (not rows.length) says whether there's more.
    getNextPageParam: (last: Page, all: Page[]) => ((last as Page & { full?: boolean }).full ?? last.rows.length >= PAGE ? all.length * PAGE : undefined),
    enabled: tab !== "posts" || !!filters,
    queryFn: async ({ pageParam }): Promise<Page> => {
      const author = `author:profiles!${tab}_author_id_fkey(${AUTHOR_COLS})`;
      const sel = tab === "posts" ? `*, ${author}, comments(count)` : `*, ${author}`;
      let rows: AnyItem[];
      let pageSize = PAGE;
      if (tab === "posts" && sort === "top") {
        // Top this week: the database ranks the ids, then the posts are loaded in that order.
        const { data: top, error: te } = await supabase.rpc("top_posts", { p_scope: scope, p_kind: kind, p_offset: pageParam, p_limit: PAGE });
        if (te) throw new Error("Top this week isn't switched on yet. Ask your admin to run the latest database update.");
        const order = ((top || []) as { id: string }[]).map((t) => t.id);
        pageSize = order.length;
        const { data } = order.length ? await supabase.from("posts").select(sel).in("id", order) : { data: [] };
        const byId = new Map(((data || []) as unknown as AnyItem[]).map((r) => [r.id, r]));
        rows = order.map((id) => byId.get(id)).filter(Boolean) as AnyItem[];
      } else {
        let q = supabase.from(tab).select(sel);
        if (tab === "posts" && india) q = q.eq("visibility", "india");
        if (tab === "posts" && kind) q = q.eq("kind", kind);
        if (!india) q = q.eq("college_id", scope);
        q = tab === "events" ? q.gte("event_date", todayIST()).order("event_date", { ascending: true }) : q.order("created_at", { ascending: false });
        const { data, error: err } = await q.range(pageParam, pageParam + PAGE - 1);
        if (err) throw new Error(friendlyError(err, "Couldn't load this page. Try again."));
        rows = (data || []) as unknown as AnyItem[];
      }
      const fullPage = pageSize >= PAGE;
      if (tab === "posts" && filters) rows = rows.filter((r) => !filters.hidden.includes(r.id) && !filters.muted.includes(r.author_id));
      const ids = rows.map((r) => r.id);
      let likes: Page["likes"] = {};
      let saved: string[] = [];
      let polls: Page["polls"] = {};
      const rsvps: Page["rsvps"] = {};
      const likeType = LIKE_TYPE_OF[tab];
      if (tab === "posts") {
        ({ likes, saved, polls } = await loadExtras(supabase, ids, me.id));
      } else if (likeType && ids.length) {
        const { data: ls } = await supabase.from("likes").select("item_id,user_id").eq("item_type", likeType).in("item_id", ids);
        likes = groupLikes((ls || []) as { item_id: string; user_id: string }[], me.id);
      }
      if (tab === "events" && ids.length) {
        const { data: rs } = await supabase.from("event_rsvps").select("event_id,user_id,status").in("event_id", ids);
        (rs || []).forEach((x: { event_id: string; user_id: string; status: RsvpStatus }) => {
          const e = (rsvps[x.event_id] ||= { going: 0, mine: null });
          if (x.status === "going") e.going++;
          if (x.user_id === me.id) e.mine = x.status;
        });
      }
      return { rows, likes, saved, polls, rsvps, full: fullPage } as Page;
    },
  });
  const error = feed.error ? (feed.error as Error).message : "";
  const items = useMemo(() => feed.data
    ? feed.data.pages.flatMap((p) => p.rows).filter((r) => !removed.has(r.id)).map((r) => (patched[r.id] ? { ...r, ...patched[r.id] } as AnyItem : r))
    : null, [feed.data, removed, patched]);
  const likeMap = useMemo(() => ({ ...Object.assign({}, ...(feed.data?.pages.map((p) => p.likes) || [])), ...likeOver }), [feed.data, likeOver]) as Record<string, Likes>;
  const savedSet = useMemo(() => {
    const set = new Set(feed.data?.pages.flatMap((p) => p.saved || []) || []);
    for (const [id, v] of Object.entries(savedOver)) { if (v) set.add(id); else set.delete(id); }
    return set;
  }, [feed.data, savedOver]);
  const rsvpMap = useMemo(() => Object.assign({}, ...(feed.data?.pages.map((p) => p.rsvps) || [])), [feed.data]) as Page["rsvps"];
  // Fresh data from the server replaces quick local changes.
  const pollMap = useMemo(() => ({ ...Object.assign({}, ...(feed.data?.pages.map((p) => p.polls || {}) || [])), ...pollOver }), [feed.data, pollOver]) as Record<string, Poll>;
  useEffect(() => { setLikeOver({}); setPatched({}); setSavedOver({}); setPollOver({}); }, [feed.dataUpdatedAt]);
  const reload = () => qc.invalidateQueries({ queryKey: key });

  // The line under the college name: how many students, how many posts today. Only real numbers.
  const todayQ = useQuery({
    queryKey: ["posts-today", scope],
    enabled: tab === "posts",
    staleTime: 60_000,
    queryFn: async () => {
      let q = supabase.from("posts").select("id", { count: "exact", head: true }).gte("created_at", startOfTodayIST());
      q = india ? q.eq("visibility", "india") : q.eq("college_id", scope);
      const { count } = await q;
      return count || 0;
    },
  });

  // Posts that arrived while reading: a "new posts" button instead of the list jumping.
  const newest = items?.reduce((m, r) => (r.created_at > m ? r.created_at : m), "") || undefined;
  const freshQ = useQuery({
    queryKey: ["fresh", scope, kind, newest],
    enabled: tab === "posts" && sort === "latest" && !!newest,
    refetchInterval: NEW_POSTS_EVERY,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      let q = supabase.from("posts").select("id", { count: "exact", head: true }).gt("created_at", newest!);
      q = india ? q.eq("visibility", "india") : q.eq("college_id", scope);
      if (kind) q = q.eq("kind", kind);
      const { count } = await q;
      return count || 0;
    },
  });
  const freshCount = freshQ.data || 0;
  function showFresh() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    reload();
    qc.invalidateQueries({ queryKey: ["posts-today", scope] });
  }

  // The pinned post of this college (Den admins pin one at a time).
  const pinnedQ = useQuery({
    queryKey: ["pinned", scope],
    enabled: tab === "posts" && !india,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("posts").select(`*, author:profiles!posts_author_id_fkey(${AUTHOR_COLS}), comments(count)`)
        .eq("college_id", scope).not("pinned_at", "is", null).order("pinned_at", { ascending: false }).limit(1);
      if (error || !data?.length) return null;
      const post = data[0] as unknown as AnyItem;
      return { post, extras: await loadExtras(supabase, [post.id], me.id) };
    },
  });
  const pinned = pinnedQ.data && !removed.has(pinnedQ.data.post.id) && !filters?.hidden.includes(pinnedQ.data.post.id) ? pinnedQ.data : null;

  // Pull down at the top of the feed to refresh (phones).
  const pull = usePullToRefresh(async () => {
    await Promise.all([qc.refetchQueries({ queryKey: key }), qc.refetchQueries({ queryKey: ["happening", scope] }), qc.refetchQueries({ queryKey: ["pinned", scope] })]);
    qc.invalidateQueries({ queryKey: ["posts-today", scope] });
  }, tab === "posts");

  const liveQ = useQuery({
    queryKey: ["live", scope],
    enabled: tab !== "posts",
    queryFn: async () => {
      let q = supabase.from("spaces").select(`*, host:profiles!spaces_host_id_fkey(${AUTHOR_COLS})`).eq("status", "live");
      q = india ? q.eq("visibility", "india") : q.eq("college_id", scope);
      const { data } = await q.order("started_at", { ascending: false }).limit(5);
      return (data || []) as Space[];
    },
  });
  const liveSpaces = liveQ.data || [];

  function headLine() {
    const today = todayQ.data;
    const posts = today ? `${today} post${today === 1 ? "" : "s"} today` : "";
    if (india) return ["Posts shared with every college on Den", posts].filter(Boolean).join(" · ");
    const n = sc?.students || 0;
    const students = n ? `${n.toLocaleString("en-IN")} student${n === 1 ? "" : "s"} on Den` : "";
    if (!isMine) return ["You're visiting", students, posts].filter(Boolean).join(" · ") + ". Your posts go to your own college.";
    return ["Your college", students, posts].filter(Boolean).join(" · ");
  }

  // The search button in the top bar opens and closes the search box.
  useEffect(() => {
    const toggle = () => setSearching((v) => { if (v) setQuery(""); return !v; });
    window.addEventListener("den:search", toggle);
    return () => window.removeEventListener("den:search", toggle);
  }, []);

  function closeComposer() {
    setComposing(false);
    if (startComposing) router.replace(india ? `/india?tab=${tab}` : `/c/${scope}?tab=${tab}`);
  }

  const pinnedId = tab === "posts" && !kind && sort === "latest" ? pinnedQ.data?.post.id : undefined;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!items) return null;
    const list = pinnedId ? items.filter((i) => i.id !== pinnedId) : items;
    if (!q) return list;
    return list.filter((i) => (JSON.stringify(i) + " " + (i.author?.name || "")).toLowerCase().includes(q));
  }, [items, query, pinnedId]);

  async function toggleLike(item: AnyItem, reaction?: string) {
    if (!gate("like posts")) return;
    const likeType = LIKE_TYPE_OF[tab]; if (!likeType) return;
    const cur = likeMap[item.id] || NO_LIKES;
    const { next, op, reaction: r } = nextLikes(cur, tab === "posts" ? reaction : undefined);
    setLikeOver((m) => ({ ...m, [item.id]: next }));
    const match = { user_id: me.id, item_type: likeType, item_id: item.id };
    const res = op === "delete" ? await supabase.from("likes").delete().match(match)
      : op === "update" ? await supabase.from("likes").update({ reaction: r }).match(match)
      : await supabase.from("likes").insert(r === "heart" ? { item_type: likeType, item_id: item.id } : { item_type: likeType, item_id: item.id, reaction: r });
    if (res.error) { setLikeOver((m) => ({ ...m, [item.id]: cur })); toast(friendlyError(res.error)); }
  }

  async function vote(item: AnyItem, choice: number) {
    if (!gate("vote in polls")) return;
    const cur = pollMap[item.id]; if (!cur) return;
    const { next, op } = nextPoll(cur, choice);
    setPollOver((m) => ({ ...m, [item.id]: next }));
    const match = { post_id: item.id, user_id: me.id };
    const res = op === "delete" ? await supabase.from("poll_votes").delete().match(match)
      : op === "update" ? await supabase.from("poll_votes").update({ choice }).match(match)
      : await supabase.from("poll_votes").insert({ post_id: item.id, choice });
    if (res.error) { setPollOver((m) => ({ ...m, [item.id]: cur })); toast(friendlyError(res.error, "Couldn't save your vote.")); }
  }

  async function hide(item: AnyItem) {
    setRemoved((r) => new Set(r).add(item.id));
    const { error: err } = await supabase.from("hidden_posts").insert({ post_id: item.id });
    if (err) { setRemoved((r) => { const n = new Set(r); n.delete(item.id); return n; }); return toast(friendlyError(err, "Couldn't hide that.")); }
    qc.invalidateQueries({ queryKey: ["feed-filters", me.id] });
    toast("Post hidden. You won't see it again.");
  }

  async function mute(item: AnyItem) {
    const name = item.author?.name || "this person";
    const { error: err } = await supabase.from("muted_users").insert({ muted_id: item.author_id });
    if (err && !/duplicate/i.test(err.message)) return toast(friendlyError(err, "Couldn't mute them."));
    const theirs = (items || []).filter((r) => r.author_id === item.author_id).map((r) => r.id);
    setRemoved((r) => { const n = new Set(r); theirs.forEach((id) => n.add(id)); return n; });
    qc.invalidateQueries({ queryKey: ["feed-filters", me.id] });
    toast(`Muted ${name}. Unmute from their profile any time.`);
  }

  async function pin(item: AnyItem, on: boolean) {
    const { error: err } = await supabase.rpc("admin_pin_post", { p_post: item.id, p_pin: on });
    if (err) return toast(friendlyError(err, "Couldn't pin that."));
    toast(on ? "Pinned to the top" : "Unpinned");
    qc.invalidateQueries({ queryKey: ["pinned", scope] }); reload();
  }

  /** A post just written shows at the top straight away, without reloading the list. */
  async function addNewPost(id: string) {
    const { data } = await supabase.from("posts").select(`*, author:profiles!posts_author_id_fkey(${AUTHOR_COLS}), comments(count)`).eq("id", id).maybeSingle();
    const row = data as unknown as AnyItem | null;
    if (!row) return reload();
    const fits = (!kind || (row as { kind?: string }).kind === kind) && (india ? (row as { visibility?: string }).visibility === "india" : row.college_id === scope);
    if (fits && sort === "latest") {
      const extras = await loadExtras(supabase, [id], me.id);
      qc.setQueryData(key, (old: { pages: Page[]; pageParams: unknown[] } | undefined) => old && ({
        ...old, pages: old.pages.map((pg, i) => i === 0 ? { ...pg, rows: [row, ...pg.rows.filter((r) => r.id !== id)], polls: { ...pg.polls, ...extras.polls }, likes: { ...pg.likes, ...extras.likes } } : pg),
      }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    qc.invalidateQueries({ queryKey: ["posts-today", scope] });
  }

  async function toggleSave(item: AnyItem) {
    const was = savedSet.has(item.id);
    setSavedOver((m) => ({ ...m, [item.id]: !was }));
    const res = was
      ? await supabase.from("saved_posts").delete().match({ user_id: me.id, post_id: item.id })
      : await supabase.from("saved_posts").insert({ post_id: item.id });
    if (res.error) { setSavedOver((m) => ({ ...m, [item.id]: was })); return toast(friendlyError(res.error, "Couldn't save that. Try again.")); }
    toast(was ? "Removed from Saved" : "Saved. Find it in the menu under Saved posts.");
    qc.invalidateQueries({ queryKey: ["saved"] });
  }

  async function remove(item: AnyItem) {
    const { error: err } = await supabase.from(tab).delete().eq("id", item.id);
    if (err) return toast(friendlyError(err, "Couldn't delete that."));
    setRemoved((r) => new Set(r).add(item.id));
    toast("Deleted");
  }

  async function toggleSold(item: AnyItem) {
    const sold = !(item as { sold?: boolean }).sold;
    const { error: err } = await supabase.from("listings").update({ sold }).eq("id", item.id);
    if (err) return toast(friendlyError(err));
    setPatched((p) => ({ ...p, [item.id]: { ...p[item.id], sold } as Partial<AnyItem> }));
  }

  const sec = SECTIONS[tab];
  const canPostHere = isMine || india;

  return (
    <main className={`wrap page ${tab === "posts" ? "feed-page home-wide" : ""}`}>
      <div className="home-col">
      {tab === "posts" && (pull.pull > 0 || pull.busy) && (
        <div className="ptr" style={{ height: pull.pull }} aria-live="polite">
          {pull.busy ? <span className="spinner" /> : <span className={`ptr-arrow ${pull.ready ? "up" : ""}`}>↓</span>}
          <small>{pull.busy ? "Refreshing…" : pull.ready ? "Release to refresh" : "Pull to refresh"}</small>
        </div>
      )}
      {tab === "posts" && <><VerifyBanner /><VouchInbox /></>}
      {tab !== "posts" && (
        <div className="page-head">
          <h1>{TITLES[tab]}</h1>
          <span>{india ? "All India" : sc?.name || "College"}</span>
        </div>
      )}
      {tab === "posts" && (
        <header className="home-head">
          <h1>{india ? "All India" : sc?.name || "College"}</h1>
          <p>{headLine()}</p>
        </header>
      )}
      {tab === "posts" && canPostHere && (
        <div className="ask-box">
          <Avatar id={me.id} name={me.name} />
          <button className="ask-input" onClick={() => { if (gate("post")) setComposing(true); }}>
            {india ? "Share something with every college…" : "Ask a doubt, share campus news…"}
          </button>
          <button className="ask-photo" aria-label="Post a photo" onClick={() => { if (gate("post")) setComposing(true); }}><Icon name="image" size={20} /></button>
        </div>
      )}
      {tab === "posts" && <div className="hap-mobile"><Happening scope={scope} variant="strip" /></div>}
      {tab === "posts" && (kind || !!items?.length) && (
        <div className="kind-chips" role="group" aria-label="Show">
          {KINDS.map((k) => (
            <button key={k.id || "all"} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</button>
          ))}
        </div>
      )}
      {tab === "posts" && (kind || !!items?.length || sort === "top") && (
        <div className="sort-row">
          <div className="seg" role="group" aria-label="Order">
            <button aria-pressed={sort === "latest"} onClick={() => setSort("latest")}>Latest</button>
            <button aria-pressed={sort === "top"} onClick={() => setSort("top")}>Top this week</button>
          </div>
        </div>
      )}
      {tab === "posts" && pinned && !kind && sort === "latest" && (
        <div className="feed pinned-wrap">
          <ItemCard type="posts" item={pinned.post} showCollege={false}
            likes={(likeOver[pinned.post.id] || pinned.extras.likes[pinned.post.id] || NO_LIKES).n} liked={!!(likeOver[pinned.post.id] || pinned.extras.likes[pinned.post.id])?.mine}
            reactions={likeOver[pinned.post.id] || pinned.extras.likes[pinned.post.id] || NO_LIKES} saved={savedSet.has(pinned.post.id) || (savedOver[pinned.post.id] ?? pinned.extras.saved.includes(pinned.post.id))}
            poll={pollOver[pinned.post.id] || pinned.extras.polls[pinned.post.id]}
            actions={{
              onLike: () => toggleLike(pinned.post), onReact: (r) => toggleLike(pinned.post, r), onSave: () => toggleSave(pinned.post),
              onVote: (c) => vote(pinned.post, c), onHide: () => hide(pinned.post), onMute: () => mute(pinned.post), onPin: (on) => pin(pinned.post, on),
              onDelete: () => remove(pinned.post), onReport: () => setReporting(pinned.post.id),
              onEdited: () => qc.invalidateQueries({ queryKey: ["pinned", scope] }),
            }} />
        </div>
      )}
      {tab !== "posts" && liveSpaces.length > 0 && (
        <div className="live-strip">
          {liveSpaces.map((s) => (
            <Link key={s.id} href={`/spaces/${s.id}`} className="live-row">
              <span className="tag live">LIVE</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</b>
                <span className="meta">{s.mode === "debate" ? "Debate" : "Space"} hosted by {s.host?.name || "a student"}, started {timeAgo(s.started_at)}</span>
              </div>
              <span className="secondary">Join</span>
            </Link>
          ))}
        </div>
      )}
      {freshCount > 0 && (
        <button className="fresh-pill" onClick={showFresh}>↑ {freshCount} new post{freshCount === 1 ? "" : "s"}</button>
      )}

      {tab === "events" && (
        <div className="sec-head">
          <small>{shown ? `${shown.length} upcoming` : ""}</small>
          <Link className="link-btn" href="/events" style={{ marginTop: 0 }}><Icon name="ticket" size={15} /> My events</Link>
        </div>
      )}

      {!canPostHere && tab !== "posts" && <p className="notice">You're browsing {sc?.name || "another college"}. You can read and react here; new posts go to your own college.</p>}

      {(searching || query) && (
        <div className="search drop">
          <Icon name="search" size={17} />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${TITLES[tab].toLowerCase()}`} aria-label={`Search ${TITLES[tab].toLowerCase()}`} />
          <button className="plain-btn" aria-label="Close search" onClick={() => { setQuery(""); setSearching(false); }}><Icon name="x" size={17} /></button>
        </div>
      )}

      {error && <p className="warn">{error}</p>}
      {shown === null ? <Skeleton flat={tab === "posts"} /> :
        shown.length === 0 && tab === "posts" && !query && !kind ? (
          <EmptyCollege name={india ? "" : sc?.name || "this college"} mine={isMine} india={india}
            myCollege={college(me.college_id)?.name} onWrite={() => { if (gate("post")) setComposing(true); }} />
        ) : shown.length === 0 ? (
          <div className="empty">
            {query ? "Nothing matches that search." : kind ? KIND_EMPTY[kind] : sec.empty}
            {!query && canPostHere && <button className="secondary" onClick={() => { if (gate("post")) setComposing(true); }}>{sec.cta}</button>}
          </div>
        ) : (
          <Virtuoso
            useWindowScroll
            data={shown}
            computeItemKey={(_, item) => item.id}
            increaseViewportBy={{ top: 600, bottom: 1200 }}
            endReached={() => { if (feed.hasNextPage && !feed.isFetchingNextPage && !query) feed.fetchNextPage(); }}
            className={tab === "posts" ? "feed" : "vlist"}
            itemContent={(_, item) => tab === "events" ? (
              <div className="vitem"><EventCard ev={item as CampusEvent} showCollege={india}
                going={rsvpMap[item.id]?.going || 0} mine={rsvpMap[item.id]?.mine} organiser={item.author_id === me.id} /></div>
            ) : (
              <div className={tab === "posts" ? "" : "vitem"}><ItemCard type={tab} item={item} showCollege={india}
                likes={likeMap[item.id]?.n || 0} liked={!!likeMap[item.id]?.mine}
                reactions={tab === "posts" ? likeMap[item.id] || NO_LIKES : undefined} saved={savedSet.has(item.id)} poll={tab === "posts" ? pollMap[item.id] : undefined}
                actions={{
                  onVote: tab === "posts" ? (c) => vote(item, c) : undefined,
                  onHide: () => hide(item), onMute: () => mute(item), onPin: (on) => pin(item, on),
                  onEdited: (b) => setPatched((p) => ({ ...p, [item.id]: { ...p[item.id], body: b, edited_at: new Date().toISOString() } as Partial<AnyItem> })),
                  onLike: LIKE_TYPE_OF[tab] ? () => toggleLike(item) : undefined,
                  onReact: tab === "posts" ? (r) => toggleLike(item, r) : undefined,
                  onSave: tab === "posts" ? () => toggleSave(item) : undefined,
                  onDelete: () => remove(item),
                  onReport: () => setReporting(item.id),
                  onToggleSold: tab === "listings" ? () => toggleSold(item) : undefined,
                }} /></div>
            )}
            components={{
              Footer: () => feed.isFetchingNextPage ? <div className="more-loading"><span className="spinner" /></div>
                : !feed.hasNextPage && shown.length >= PAGE && !query ? <p className="end-note">You&rsquo;re all caught up</p> : null,
            }}
          />
        )}

      </div>
      {tab === "posts" && <Happening scope={scope} variant="rail" />}
      {canPostHere && <button className={`fab ${tab === "posts" ? "fab-home" : ""}`} onClick={() => { if (gate("post")) setComposing(true); }} aria-label={sec.cta}><Icon name="plus" size={24} /><span>{sec.cta}</span></button>}
      {composing && <Composer section={tab} defaultIndia={india} onClose={closeComposer} onPosted={(id) => { setComposing(false); if (tab === "events" && id) router.push(`/events/${id}`); else { if (startComposing) closeComposer(); if (tab === "posts" && id) addNewPost(id); else reload(); } }} />}
      {reporting && <ReportSheet targetType={REPORT_TYPE_OF[tab]} targetId={reporting} onClose={() => setReporting(null)} />}
    </main>
  );
}

function Skeleton({ flat }: { flat?: boolean }) {
  return (
    <div className={flat ? "feed" : "list"} aria-busy="true" aria-label="Loading">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={flat ? "post skel" : "card skel"}>
          <span className="sk sk-av" /><div style={{ flex: 1 }}><span className="sk sk-line w40" /><span className="sk sk-line" /><span className="sk sk-line w70" /></div>
        </div>
      ))}
    </div>
  );
}

/** The first thing a student sees at a college nobody has posted in yet. */
function EmptyCollege({ name, mine, india, myCollege, onWrite }: { name: string; mine: boolean; india: boolean; myCollege?: string; onWrite: () => void }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const wa = whatsappLink(inviteMessage(mine ? name : myCollege, origin));
  if (india) return (
    <div className="first-post">
      <b>Nothing shared with All India yet</b>
      <p>Posts marked &ldquo;All India&rdquo; show up here for every college on Den.</p>
      <button className="primary" onClick={onWrite}>Share the first one</button>
    </div>
  );
  if (mine) return (
    <div className="first-post">
      <span className="first-kicker">Be the first</span>
      <b>Start {name} on Den</b>
      <p>Every college starts with one post. Say hello, ask a doubt or share campus news, then bring your batch in.</p>
      <div className="first-acts">
        <button className="primary" onClick={onWrite}>Write the first post</button>
        <a className="secondary" href={wa} target="_blank" rel="noopener noreferrer"><Icon name="users" size={17} /> Invite classmates on WhatsApp</a>
      </div>
    </div>
  );
  return (
    <div className="first-post">
      <b>Nobody from {name} has posted yet</b>
      <p>Know someone there? Send them Den, and they can be the first.</p>
      <div className="first-acts">
        <a className="secondary" href={whatsappLink(`Is anyone from ${name} on Den? It's the student hangout for every college in India: ${origin}/signup`)} target="_blank" rel="noopener noreferrer"><Icon name="users" size={17} /> Send Den on WhatsApp</a>
      </div>
    </div>
  );
}
