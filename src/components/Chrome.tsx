"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, createContext, useContext, type ReactNode } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useApp } from "./AppContext";
import CollegeSearch from "./CollegeSearch";
import { useToast } from "./Toast";
import Icon, { VerifiedTick, type IconName } from "./Icon";
import Avatar from "./Avatar";
import ThemeToggle from "./ThemeToggle";
import { DataSaverToggle, InstallDen, ServiceWorker } from "./AppExtras";
import { GateProvider } from "./Gate";
import { OnlineProvider } from "./Presence";

/** Counts conversations with messages the student hasn't read yet, kept live. */
function useUnread(userId: string) {
  const [n, setN] = useState(0);
  const load = useCallback(async () => {
    const supabase = supabaseBrowser();
    const { data } = await supabase
      .from("conversation_members")
      .select("last_read_at, conversation:conversations(last_message_at, last_sender_id)")
      .eq("user_id", userId);
    type Row = { last_read_at: string; conversation: { last_message_at: string; last_sender_id: string | null } | null };
    const rows = (data || []) as unknown as Row[];
    setN(rows.filter((r) => r.conversation && r.conversation.last_sender_id && r.conversation.last_sender_id !== userId
      && new Date(r.conversation.last_message_at) > new Date(r.last_read_at)).length);
  }, [userId]);

  useEffect(() => {
    load();
    const supabase = supabaseBrowser();
    const ch = supabase.channel("unread-" + userId)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_members", filter: `user_id=eq.${userId}` }, () => load())
      .subscribe();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { supabase.removeChannel(ch); window.removeEventListener("focus", onFocus); };
  }, [userId, load]);
  return n;
}

// ---------- Where am I? ----------

/** The home page the student is looking at: "india", a college id, or null when on another page. */
function useScope(): string | null {
  const path = usePathname();
  if (path === "/india") return "india";
  const m = path.match(/^\/c\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

const RECENT_KEY = "den.recentColleges";
function readRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").filter((x: unknown) => typeof x === "string"); } catch { return []; }
}

// ---------- Shared state for the menu and college switch ----------

const ChromeCtx = createContext<{ openMenu: () => void; openSwitch: () => void; unread: number }>({
  openMenu: () => {}, openSwitch: () => {}, unread: 0,
});

/** Remembers whether the laptop menu is hidden. */
const SIDE_KEY = "den_side";

export function ChromeShell({ children }: { children: ReactNode }) {
  const { me, ensureCollege } = useApp();
  const path = usePathname();
  const scope = useScope();
  const unread = useUnread(me.id);
  const [menu, setMenu] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  // Laptops: the menu sits on the left and can be hidden; the choice is remembered on this device.
  const [sideOff, setSideOff] = useState(false);
  useEffect(() => { try { setSideOff(localStorage.getItem(SIDE_KEY) === "off"); } catch { /* storage unavailable */ } }, []);
  const wide = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
  const setSide = (off: boolean) => { setSideOff(off); try { localStorage.setItem(SIDE_KEY, off ? "off" : "on"); } catch { /* storage unavailable */ } };
  const openMenu = () => { if (wide()) setSide(false); else setMenu(true); };
  const closeMenu = () => { if (wide()) setSide(true); else setMenu(false); };

  // Close the drawer and switch on every page change.
  const query = useSearchParams().toString();
  const toast = useToast();
  // Came from "Sign up with Google" with an account that already existed (the sign-in callback leaves a short cookie).
  useEffect(() => {
    if (!document.cookie.split("; ").includes("den_existing=1")) return;
    document.cookie = "den_existing=; path=/; max-age=0";
    toast("You already have a Den account, so we signed you in.");
  }, [toast]);
  useEffect(() => { setMenu(false); setSwitcher(false); }, [path, query]);

  useEffect(() => { ensureCollege(scope); }, [scope, ensureCollege]);

  // Remember other colleges the student browses.
  useEffect(() => {
    if (!scope || scope === "india" || scope === me.college_id) return;
    try {
      const next = [scope, ...readRecent().filter((x) => x !== scope)].slice(0, 3);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch { /* storage unavailable */ }
  }, [scope, me.college_id]);

  // Lock page scroll while the drawer is open on phones.
  useEffect(() => {
    if (!menu) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [menu]);

  return (
    <GateProvider><OnlineProvider>
    <ChromeCtx.Provider value={{ openMenu, openSwitch: () => setSwitcher(true), unread }}>
      <div className={`shell ${sideOff ? "side-off" : ""}`}>
        <div className={`drawer-scrim ${menu ? "show" : ""}`} onClick={() => setMenu(false)} aria-hidden="true" />
        <SideMenu open={menu} onClose={closeMenu} />
        <div className="shell-main">
          <TopBar />
          {children}
        </div>
      </div>
      <BottomNav />
      <ServiceWorker />
      {switcher && <CollegeSwitch onClose={() => setSwitcher(false)} />}
    </ChromeCtx.Provider>
    </OnlineProvider></GateProvider>
  );
}

// ---------- Top bar ----------

function TopBar() {
  const { me, college } = useApp();
  const { openMenu, openSwitch } = useContext(ChromeCtx);
  const scope = useScope();
  const label = scope === "india" ? "All India" : college(scope || me.college_id)?.name || "My college";
  return (
    <header className="top">
      <div className="wrap bar">
        <div className="bar-l">
          <button className="menu-btn" onClick={openMenu} aria-label="Open menu"><Icon name="menu" size={22} /></button>
          <Link href={`/c/${me.college_id}`} className="brand" aria-label="Den home">Den<span>.</span></Link>
          {scope && (
            <button className="scope-pill" onClick={openSwitch} aria-haspopup="dialog" aria-label={`Showing ${label}. Change`}>
              <span>{label}</span><Icon name="chevDown" size={15} />
            </button>
          )}
        </div>
        <div className="acts">
          {scope && (
            <button className="plain-btn" aria-label="Search this page" onClick={() => window.dispatchEvent(new Event("den:search"))}>
              <Icon name="search" size={21} />
            </button>
          )}
          <Link href="/me" aria-label="Your profile" className="me-link"><Avatar id={me.id} name={me.name} /></Link>
        </div>
      </div>
    </header>
  );
}

// ---------- College switch (drops down from the top) ----------

function CollegeSwitch({ onClose }: { onClose: () => void }) {
  const { me, college, colleges, ensureCollege } = useApp();
  const scope = useScope();
  const router = useRouter();
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => { readRecent().forEach(ensureCollege); }, [ensureCollege]);
  useEffect(() => { setRecent(readRecent().filter((id) => id !== me.college_id && college(id))); }, [me.college_id, college]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mine = college(me.college_id);
  const go = (href: string) => { onClose(); router.push(href); };
  const Row = ({ id, href, title, sub, badge }: { id: string; href: string; title: string; sub: string; badge: string }) => (
    <button className={`switch-row ${scope === id ? "on" : ""}`} onClick={() => go(href)}>
      <span className="switch-badge">{badge}</span>
      <span className="switch-text"><b>{title}</b><small>{sub}</small></span>
      {scope === id && <Icon name="check" size={20} />}
    </button>
  );
  const initials = (n: string) => n.split(/\s+/).filter((w) => /^[A-Z0-9]/.test(w)).map((w) => w[0]).join("").slice(0, 3) || n.slice(0, 2).toUpperCase();

  return (
    <div className="topsheet-scrim" onClick={onClose}>
      <div className="topsheet" role="dialog" aria-modal="true" aria-label="Show posts from" onClick={(e) => e.stopPropagation()}>
        <div className="wrap">
          <h3>Show posts from</h3>
          <Row id={me.college_id} href={`/c/${me.college_id}`} title={mine?.name || "My college"} sub="Your college" badge={initials(mine?.name || "MC")} />
          <Row id="india" href="/india" title="All India" sub="Posts shared with every college on Den" badge="IN" />
          {recent.length > 0 && <>
            <div className="switch-label">Recently visited</div>
            {recent.map((id) => <Row key={id} id={id} href={`/c/${id}`} title={college(id)!.name} sub={college(id)!.city} badge={initials(college(id)!.name)} />)}
          </>}
          <div className="switch-label">Visit another college</div>
          <CollegeSearch className="switch-search" placeholder="Search any college in India"
            suggestions={colleges.filter((c) => c.id !== me.college_id).slice(0, 6)}
            onPick={(c) => go(`/c/${c.id}`)} />
          <Link href="/colleges" className="switch-browse" onClick={onClose}>Browse all colleges on Den <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </div>
  );
}

// ---------- Side menu (slides in on phones, always visible on laptops) ----------

type Item = { href: string; label: string; icon: IconName; on?: boolean; tag?: string; badge?: number };

function SideMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, collegeName, canAct } = useApp();
  const { unread } = useContext(ChromeCtx);
  const path = usePathname();
  const scope = useScope();
  const tab = useSearchParams().get("tab") || "";

  // Notes, placements and market follow the home page you're on.
  const base = scope === "india" ? "/india" : `/c/${scope || me.college_id}`;
  const marketBase = scope && scope !== "india" ? `/c/${scope}` : `/c/${me.college_id}`;
  const onScope = !!scope;

  const main: Item[] = [
    { href: `/c/${me.college_id}`, label: "Home", icon: "home", on: onScope && (!tab || tab === "posts") },
    { href: "/spaces", label: "Spaces", icon: "radio", on: path.startsWith("/spaces") },
    { href: "/events", label: "Events", icon: "calendar", on: path.startsWith("/events") || tab === "events" },
    { href: "/messages", label: "Messages", icon: "chat", on: path.startsWith("/messages"), badge: unread },
  ];
  const study: Item[] = [
    { href: `${base}?tab=notes`, label: "Notes & PYQs", icon: "file", on: onScope && tab === "notes" },
    { href: `${base}?tab=placements`, label: "Placements", icon: "briefcase", on: onScope && tab === "placements" },
    { href: `${marketBase}?tab=listings`, label: "Market", icon: "bag", on: onScope && tab === "listings" },
    { href: "/articles", label: "Articles", icon: "article", on: path === "/articles" || (path.startsWith("/articles/") && !path.endsWith("/new")), tag: "New" },
    { href: "/ask", label: "Ask a senior", icon: "spark", on: path.startsWith("/ask"), tag: "AI" },
  ];
  const create: Item[] = [
    { href: canAct ? `/c/${me.college_id}?tab=events&new=1` : "/verify", label: "Create an event", icon: "calPlus" },
    { href: canAct ? "/spaces?new=1" : "/verify", label: "Start a Space or debate", icon: "mic" },
    { href: canAct ? "/articles/new" : "/verify", label: "Write an article", icon: "pen", on: path === "/articles/new" },
  ];
  const yours: Item[] = [
    { href: "/events?tab=going", label: "My events & tickets", icon: "ticket" },
    { href: "/articles?tab=mine", label: "My articles & drafts", icon: "article" },
    { href: "/saved", label: "Saved posts", icon: "bookmark", on: path === "/saved" },
  ];

  const link = (it: Item) => (
    <Link key={it.label} href={it.href} className={`side-link ${it.on ? "on" : ""}`} aria-current={it.on ? "page" : undefined} onClick={onClose}>
      <Icon name={it.icon} size={21} /><span>{it.label}</span>
      {it.tag && <em className={it.tag === "AI" ? "ai" : ""}>{it.tag}</em>}
      {!!it.badge && <span className="badge">{it.badge > 9 ? "9+" : it.badge}</span>}
    </Link>
  );

  return (
    <aside className={`side ${open ? "open" : ""}`} aria-label="Menu" aria-hidden={undefined}>
      <div className="side-head">
        <Link href={`/c/${me.college_id}`} className="brand" onClick={onClose}>Den<span>.</span></Link>
        <button className="plain-btn side-close" onClick={onClose} aria-label="Close menu"><Icon name="x" size={20} /></button>
        <button className="plain-btn side-hide" onClick={onClose} aria-label="Hide menu" title="Hide menu"><Icon name="sidebar" size={20} /></button>
      </div>
      <Link href="/me" className="side-me" onClick={onClose}>
        <Avatar id={me.id} name={me.name} />
        <span><b>{me.name}{me.verified && <VerifiedTick />}</b><small>{[collegeName(me.college_id), me.branch].filter(Boolean).join(" · ")}</small></span>
        <Icon name="chevRight" size={16} />
      </Link>
      {!me.verified && (
        <Link href="/verify" className="side-verify" onClick={onClose}><Icon name="shield" size={18} /> Get your blue tick <Icon name="chevRight" size={15} /></Link>
      )}
      <nav className="side-scroll">
        <div className="side-main">{main.map(link)}</div>
        <div className="side-label">Study &amp; career</div>{study.map(link)}
        <div className="side-label">Create</div>{create.map(link)}
        <div className="side-label">Yours</div>{yours.map(link)}
        <div className="side-foot">
          <InstallDen />
          <ThemeToggle />
          <DataSaverToggle />
          {link({ href: "/me", label: "Settings", icon: "gear", on: path === "/me" })}
          {link({ href: "/guidelines", label: "Help & policies", icon: "help" })}
        </div>
      </nav>
    </aside>
  );
}

// ---------- Bottom tabs (phones) ----------

function BottomNav() {
  const { me } = useApp();
  const path = usePathname();
  const { unread } = useContext(ChromeCtx);
  const scope = useScope();
  const items: Item[] = [
    { href: `/c/${me.college_id}`, label: "Home", icon: "home", on: !!scope || path === "/colleges" },
    { href: "/spaces", label: "Spaces", icon: "radio", on: path.startsWith("/spaces") },
    { href: "/events", label: "Events", icon: "calendar", on: path.startsWith("/events") },
    { href: "/messages", label: "Messages", icon: "chat", on: path.startsWith("/messages"), badge: unread },
  ];
  return (
    <nav className="nav" aria-label="Main">
      <div className="wrap">
        {items.map((it) => (
          <Link key={it.label} href={it.href} className={it.on ? "on" : ""} aria-current={it.on ? "page" : undefined}>
            <Icon name={it.icon} size={23} />
            {it.label}
            {!!it.badge && <span className="badge" aria-label={`${it.badge} unread`}>{it.badge > 9 ? "9+" : it.badge}</span>}
          </Link>
        ))}
      </div>
    </nav>
  );
}
