"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
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

const INDIA_TABS: SectionKey[] = ["posts", "notes", "placements", "events"];
const COLLEGE_TABS: SectionKey[] = ["posts", "notes", "placements", "listings", "events"];

const TITLES: Record<SectionKey, string> = { posts: "Feed", notes: "Notes & PYQs", placements: "Placements", listings: "Market", events: "Events" };

export default function ScopeHome({ scope, initialTab, startComposing }: { scope: string; initialTab?: string; startComposing?: boolean }) {
  const { me, college } = useApp();
  const toast = useToast();
  const router = useRouter();
  const supabase = supabaseBrowser();
  const india = scope === "india";
  const sc = college(scope);
  const isMine = scope === me.college_id;
  const tabs = india ? INDIA_TABS : COLLEGE_TABS;
  const [tab] = useState<SectionKey>(tabs.includes(initialTab as SectionKey) ? (initialTab as SectionKey) : "posts");
  const [searching, setSearching] = useState(false);
  const [items, setItems] = useState<AnyItem[] | null>(null);
  const [rsvpMap, setRsvpMap] = useState<Record<string, { going: number; mine: RsvpStatus | null }>>({});
  const [likeMap, setLikeMap] = useState<Record<string, { n: number; mine: boolean }>>({});
  const [liveSpaces, setLiveSpaces] = useState<Space[]>([]);
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(!!startComposing && (scope === me.college_id || scope === "india"));
  const [reporting, setReporting] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const author = `author:profiles!${tab}_author_id_fkey(${AUTHOR_COLS})`;
    const sel = tab === "posts" ? `*, ${author}, comments(count)` : `*, ${author}`;
    let q = supabase.from(tab).select(sel);
    if (tab === "posts" && india) q = q.eq("visibility", "india");
    if (!india) q = q.eq("college_id", scope);
    if (tab === "events") {
      q = q.gte("event_date", todayIST()).order("event_date", { ascending: true });
    } else {
      q = q.order("created_at", { ascending: false });
    }
    const { data, error: err } = await q.limit(60);
    if (err) { setItems([]); setError(friendlyError(err, "Couldn't load this page. Pull to refresh or try again.")); return; }
    const rows = (data || []) as unknown as AnyItem[];
    setItems(rows);

    if (tab === "events" && rows.length) {
      const { data: rs } = await supabase.from("event_rsvps").select("event_id,user_id,status").in("event_id", rows.map((r) => r.id));
      const m: Record<string, { going: number; mine: RsvpStatus | null }> = {};
      (rs || []).forEach((x: { event_id: string; user_id: string; status: RsvpStatus }) => {
        const e = (m[x.event_id] ||= { going: 0, mine: null });
        if (x.status === "going") e.going++;
        if (x.user_id === me.id) e.mine = x.status;
      });
      setRsvpMap(m);
    }

    const likeType = LIKE_TYPE_OF[tab];
    if (likeType && rows.length) {
      const { data: likes } = await supabase.from("likes").select("item_id,user_id").eq("item_type", likeType).in("item_id", rows.map((r) => r.id));
      const m: Record<string, { n: number; mine: boolean }> = {};
      (likes || []).forEach((l: { item_id: string; user_id: string }) => {
        const e = (m[l.item_id] ||= { n: 0, mine: false });
        e.n++; if (l.user_id === me.id) e.mine = true;
      });
      setLikeMap(m);
    } else setLikeMap({});
  }, [tab, india, scope, supabase, me.id]);

  useEffect(() => { setItems(null); load(); }, [load]);

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

  useEffect(() => {
    let q = supabase.from("spaces").select(`*, host:profiles!spaces_host_id_fkey(${AUTHOR_COLS})`).eq("status", "live");
    q = india ? q.eq("visibility", "india") : q.eq("college_id", scope);
    q.order("started_at", { ascending: false }).limit(5).then(({ data }: { data: unknown[] | null }) => setLiveSpaces((data || []) as Space[]));
  }, [india, scope, supabase]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!items) return null;
    if (!q) return items;
    return items.filter((i) => (JSON.stringify(i) + " " + (i.author?.name || "")).toLowerCase().includes(q));
  }, [items, query]);

  async function toggleLike(item: AnyItem) {
    const likeType = LIKE_TYPE_OF[tab]; if (!likeType) return;
    const cur = likeMap[item.id] || { n: 0, mine: false };
    setLikeMap({ ...likeMap, [item.id]: { n: cur.n + (cur.mine ? -1 : 1), mine: !cur.mine } });
    const res = cur.mine
      ? await supabase.from("likes").delete().match({ user_id: me.id, item_type: likeType, item_id: item.id })
      : await supabase.from("likes").insert({ item_type: likeType, item_id: item.id });
    if (res.error) { setLikeMap((m) => ({ ...m, [item.id]: cur })); toast(friendlyError(res.error)); }
  }

  async function remove(item: AnyItem) {
    const { error: err } = await supabase.from(tab).delete().eq("id", item.id);
    if (err) return toast(friendlyError(err, "Couldn't delete that."));
    setItems((xs) => (xs || []).filter((x) => x.id !== item.id));
    toast("Deleted");
  }

  async function toggleSold(item: AnyItem) {
    const sold = !(item as { sold?: boolean }).sold;
    const { error: err } = await supabase.from("listings").update({ sold }).eq("id", item.id);
    if (err) return toast(friendlyError(err));
    setItems((xs) => (xs || []).map((x) => (x.id === item.id ? { ...x, sold } : x)));
  }

  const sec = SECTIONS[tab];
  const canPostHere = isMine || india;

  return (
    <main className={`wrap page ${tab === "posts" ? "feed-page" : ""}`}>
      {tab !== "posts" && (
        <div className="page-head">
          <h1>{TITLES[tab]}</h1>
          <span>{india ? "All India" : sc?.name || "College"}</span>
        </div>
      )}
      {liveSpaces.length > 0 && (
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

      {tab === "events" && (
        <div className="sec-head">
          <small>{shown ? `${shown.length} upcoming` : ""}</small>
          <Link className="link-btn" href="/events" style={{ marginTop: 0 }}><Icon name="ticket" size={15} /> My events</Link>
        </div>
      )}

      {!canPostHere && <p className="notice">You're browsing {sc?.name || "another college"}. You can read and react here; new posts go to your own college.</p>}

      {(searching || query) && (
        <div className="search drop">
          <Icon name="search" size={17} />
          <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${TITLES[tab].toLowerCase()}`} aria-label={`Search ${TITLES[tab].toLowerCase()}`} />
          <button className="plain-btn" aria-label="Close search" onClick={() => { setQuery(""); setSearching(false); }}><Icon name="x" size={17} /></button>
        </div>
      )}

      {error && <p className="warn">{error}</p>}
      {shown === null ? <Skeleton flat={tab === "posts"} /> :
        shown.length === 0 ? (
          <div className="empty">
            {query ? "Nothing matches that search." : sec.empty}
            {!query && canPostHere && <button className="secondary" onClick={() => setComposing(true)}>{sec.cta}</button>}
          </div>
        ) : (
          <div className={tab === "posts" ? "feed" : "list"}>
            {shown.map((item) => tab === "events" ? (
              <EventCard key={item.id} ev={item as CampusEvent} showCollege={india}
                going={rsvpMap[item.id]?.going || 0} mine={rsvpMap[item.id]?.mine} organiser={item.author_id === me.id} />
            ) : (
              <ItemCard key={item.id} type={tab} item={item} showCollege={india}
                likes={likeMap[item.id]?.n || 0} liked={!!likeMap[item.id]?.mine}
                actions={{
                  onLike: LIKE_TYPE_OF[tab] ? () => toggleLike(item) : undefined,
                  onDelete: () => remove(item),
                  onReport: () => setReporting(item.id),
                  onToggleSold: tab === "listings" ? () => toggleSold(item) : undefined,
                }} />
            ))}
          </div>
        )}

      {canPostHere && <button className="fab" onClick={() => setComposing(true)} aria-label={sec.cta}><Icon name="plus" size={24} /><span>{sec.cta}</span></button>}
      {composing && <Composer section={tab} defaultIndia={india} onClose={closeComposer} onPosted={(id) => { setComposing(false); if (tab === "events" && id) router.push(`/events/${id}`); else { if (startComposing) closeComposer(); load(); } }} />}
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
