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
  const [likeOver, setLikeOver] = useState<Record<string, { n: number; mine: boolean }>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [patched, setPatched] = useState<Record<string, Partial<AnyItem>>>({});
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const { canAct } = useApp();
  const [composing, setComposing] = useState(!!startComposing && canAct && (scope === me.college_id || scope === "india"));
  const [reporting, setReporting] = useState<string | null>(null);
  const qc = useQueryClient();
  const key = ["scope", scope, tab, kind] as const;

  type Page = { rows: AnyItem[]; likes: Record<string, { n: number; mine: boolean }>; rsvps: Record<string, { going: number; mine: RsvpStatus | null }> };
  const feed = useInfiniteQuery({
    queryKey: key,
    initialPageParam: 0,
    getNextPageParam: (last: Page, all: Page[]) => (last.rows.length < PAGE ? undefined : all.length * PAGE),
    queryFn: async ({ pageParam }): Promise<Page> => {
      const author = `author:profiles!${tab}_author_id_fkey(${AUTHOR_COLS})`;
      const sel = tab === "posts" ? `*, ${author}, comments(count)` : `*, ${author}`;
      let q = supabase.from(tab).select(sel);
      if (tab === "posts" && india) q = q.eq("visibility", "india");
      if (tab === "posts" && kind) q = q.eq("kind", kind);
      if (!india) q = q.eq("college_id", scope);
      q = tab === "events" ? q.gte("event_date", todayIST()).order("event_date", { ascending: true }) : q.order("created_at", { ascending: false });
      const { data, error: err } = await q.range(pageParam, pageParam + PAGE - 1);
      if (err) throw new Error(friendlyError(err, "Couldn't load this page. Try again."));
      const rows = (data || []) as unknown as AnyItem[];
      const ids = rows.map((r) => r.id);
      const likes: Page["likes"] = {};
      const rsvps: Page["rsvps"] = {};
      const likeType = LIKE_TYPE_OF[tab];
      if (likeType && ids.length) {
        const { data: ls } = await supabase.from("likes").select("item_id,user_id").eq("item_type", likeType).in("item_id", ids);
        (ls || []).forEach((l: { item_id: string; user_id: string }) => { const e = (likes[l.item_id] ||= { n: 0, mine: false }); e.n++; if (l.user_id === me.id) e.mine = true; });
      }
      if (tab === "events" && ids.length) {
        const { data: rs } = await supabase.from("event_rsvps").select("event_id,user_id,status").in("event_id", ids);
        (rs || []).forEach((x: { event_id: string; user_id: string; status: RsvpStatus }) => {
          const e = (rsvps[x.event_id] ||= { going: 0, mine: null });
          if (x.status === "going") e.going++;
          if (x.user_id === me.id) e.mine = x.status;
        });
      }
      return { rows, likes, rsvps };
    },
  });
  const error = feed.error ? (feed.error as Error).message : "";
  const items = useMemo(() => feed.data
    ? feed.data.pages.flatMap((p) => p.rows).filter((r) => !removed.has(r.id)).map((r) => (patched[r.id] ? { ...r, ...patched[r.id] } as AnyItem : r))
    : null, [feed.data, removed, patched]);
  const likeMap = useMemo(() => ({ ...Object.assign({}, ...(feed.data?.pages.map((p) => p.likes) || [])), ...likeOver }), [feed.data, likeOver]) as Record<string, { n: number; mine: boolean }>;
  const rsvpMap = useMemo(() => Object.assign({}, ...(feed.data?.pages.map((p) => p.rsvps) || [])), [feed.data]) as Page["rsvps"];
  // Fresh data from the server replaces quick local changes.
  useEffect(() => { setLikeOver({}); setPatched({}); }, [feed.dataUpdatedAt]);
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
  const newest = items?.[0]?.created_at;
  const freshQ = useQuery({
    queryKey: ["fresh", scope, kind, newest],
    enabled: tab === "posts" && !!newest,
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

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!items) return null;
    if (!q) return items;
    return items.filter((i) => (JSON.stringify(i) + " " + (i.author?.name || "")).toLowerCase().includes(q));
  }, [items, query]);

  async function toggleLike(item: AnyItem) {
    if (!gate("like posts")) return;
    const likeType = LIKE_TYPE_OF[tab]; if (!likeType) return;
    const cur = likeMap[item.id] || { n: 0, mine: false };
    setLikeOver((m) => ({ ...m, [item.id]: { n: cur.n + (cur.mine ? -1 : 1), mine: !cur.mine } }));
    const res = cur.mine
      ? await supabase.from("likes").delete().match({ user_id: me.id, item_type: likeType, item_id: item.id })
      : await supabase.from("likes").insert({ item_type: likeType, item_id: item.id });
    if (res.error) { setLikeOver((m) => ({ ...m, [item.id]: cur })); toast(friendlyError(res.error)); }
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
                actions={{
                  onLike: LIKE_TYPE_OF[tab] ? () => toggleLike(item) : undefined,
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
      {composing && <Composer section={tab} defaultIndia={india} onClose={closeComposer} onPosted={(id) => { setComposing(false); if (tab === "events" && id) router.push(`/events/${id}`); else { if (startComposing) closeComposer(); reload(); } }} />}
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
