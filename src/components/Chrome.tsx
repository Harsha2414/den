"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useApp } from "./AppContext";
import Icon from "./Icon";
import Avatar from "./Avatar";

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

export function TopBar() {
  const { me } = useApp();
  return (
    <header className="top">
      <div className="wrap bar">
        <Link href="/" className="brand">Campus <span>Adda</span></Link>
        <div className="acts">
          <Link href="/colleges" className="icon-btn" aria-label="Browse colleges"><Icon name="search" /></Link>
          <Link href="/me" aria-label="Your profile"><Avatar id={me.id} name={me.name} /></Link>
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const { me } = useApp();
  const path = usePathname();
  const unread = useUnread(me.id);
  const items = [
    { href: `/c/${me.college_id}`, label: "Home", icon: "home" as const, on: path === "/" || path.startsWith("/c/") || path === "/india" || path === "/colleges" },
    { href: "/spaces", label: "Spaces", icon: "radio" as const, on: path.startsWith("/spaces") },
    { href: "/messages", label: "Messages", icon: "chat" as const, on: path.startsWith("/messages"), badge: unread },
    { href: "/ask", label: "Ask a senior", icon: "spark" as const, on: path.startsWith("/ask") },
    { href: "/me", label: "Profile", icon: "user" as const, on: path.startsWith("/me") || path.startsWith("/u/") },
  ];
  return (
    <nav className="nav" aria-label="Main">
      <div className="wrap">
        {items.map((it) => (
          <Link key={it.label} href={it.href} className={it.on ? "on" : ""} aria-current={it.on ? "page" : undefined}>
            <Icon name={it.icon} size={22} />
            {it.label}
            {!!it.badge && <span className="badge" aria-label={`${it.badge} unread`}>{it.badge > 9 ? "9+" : it.badge}</span>}
          </Link>
        ))}
      </div>
    </nav>
  );
}
