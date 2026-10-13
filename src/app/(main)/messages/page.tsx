"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { friendlyError, timeAgo } from "@/lib/format";
import { CONV_SELECT, convOther, convTitle, isUnread, type ConvWithMembers } from "@/lib/chat";
import type { Author } from "@/lib/types";
import { useApp } from "@/components/AppContext";
import { useToast } from "@/components/Toast";
import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";
import Sheet from "@/components/Sheet";
import PeoplePicker from "@/components/PeoplePicker";

export default function MessagesPage() {
  const { me } = useApp();
  const router = useRouter();
  const toast = useToast();
  const supabase = supabaseBrowser();
  const [convs, setConvs] = useState<ConvWithMembers[] | null>(null);
  const [sheet, setSheet] = useState<null | "dm" | "group">(null);
  const [groupName, setGroupName] = useState("");
  const [picked, setPicked] = useState<Map<string, Author>>(new Map());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("conversations").select(CONV_SELECT).order("last_message_at", { ascending: false }).limit(100);
    setConvs((data || []) as unknown as ConvWithMembers[]);
  }, [supabase]);

  useEffect(() => {
    load();
    const ch = supabase.channel("inbox-" + me.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, supabase, me.id]);

  async function openDm(p: Author) {
    setBusy(true);
    const { data, error } = await supabase.rpc("start_dm", { other: p.id });
    setBusy(false);
    if (error) return toast(friendlyError(error, "Couldn't open a chat."));
    router.push(`/messages/${data}`);
  }

  async function createGroup() {
    if (!groupName.trim()) return toast("Give the group a name.");
    if (picked.size === 0) return toast("Add at least one person.");
    setBusy(true);
    const { data, error } = await supabase.rpc("create_group", { p_title: groupName.trim(), p_members: [...picked.keys()] });
    setBusy(false);
    if (error) return toast(friendlyError(error, "Couldn't create the group."));
    router.push(`/messages/${data}`);
  }

  function toggle(p: Author) {
    setPicked((m) => { const n = new Map(m); if (n.has(p.id)) n.delete(p.id); else n.set(p.id, p); return n; });
  }

  return (
    <main className="wrap page">
      <div className="sec-head"><h2>Messages</h2></div>
      <div className="row" style={{ marginTop: 0, marginBottom: 12 }}>
        <button className="secondary" onClick={() => setSheet("dm")}><Icon name="plus" size={15} /> New message</button>
        <button className="secondary" onClick={() => { setSheet("group"); setPicked(new Map()); setGroupName(""); }}><Icon name="users" size={15} /> New group</button>
      </div>

      {convs === null ? <div className="empty">Loading...</div> :
        convs.length === 0 ? <div className="empty">No conversations yet. Message a classmate, or start a group for your club or class.</div> :
        convs.map((c) => {
          const other = convOther(c, me.id);
          const unread = isUnread(c, me.id);
          return (
            <Link key={c.id} href={`/messages/${c.id}`} className="pick">
              {c.is_group
                ? <span className="av" style={{ background: "var(--teal-soft)", color: "var(--teal)" }}><Icon name="users" /></span>
                : <Avatar id={other?.user_id || c.id} name={other?.profile?.name} />}
              <div>
                <b>{convTitle(c, me.id)} {unread && <span className="tag no" style={{ marginLeft: 4 }}>New</span>}</b>
                <span style={unread ? { color: "var(--ink)", fontWeight: 600 } : undefined}>
                  {c.last_message_preview ? `${c.last_sender_id === me.id ? "You: " : ""}${c.last_message_preview}` : "No messages yet"}
                </span>
              </div>
              <span className="meta" style={{ flex: "none" }}>{timeAgo(c.last_message_at)}</span>
            </Link>
          );
        })}

      {sheet === "dm" && (
        <Sheet title="New message" onClose={() => setSheet(null)}>
          <PeoplePicker onPick={(p) => !busy && openDm(p)} />
        </Sheet>
      )}

      {sheet === "group" && (
        <Sheet title="New group" onClose={() => setSheet(null)}>
          <div className="form" style={{ marginBottom: 12 }}>
            <div className="field">
              <label htmlFor="g-name">Group name *</label>
              <input id="g-name" value={groupName} maxLength={80} onChange={(e) => setGroupName(e.target.value)} placeholder="Coding club, CSE 3rd year, Fest team..." />
            </div>
            {picked.size > 0 && <p className="meta" style={{ margin: 0 }}>Adding: {[...picked.values()].map((p) => p.name).join(", ")}</p>}
            <button className="primary" onClick={createGroup} disabled={busy}>{busy ? "Creating..." : `Create group${picked.size ? ` with ${picked.size}` : ""}`}</button>
          </div>
          <PeoplePicker multi selected={new Set(picked.keys())} onToggle={toggle} />
        </Sheet>
      )}
    </main>
  );
}
