"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { friendlyError, timeAgo } from "@/lib/format";
import { CONV_SELECT, convOther, convTitle, type ConvWithMembers } from "@/lib/chat";
import type { Author, Message } from "@/lib/types";
import { useApp } from "@/components/AppContext";
import { useToast } from "@/components/Toast";
import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";
import Sheet from "@/components/Sheet";
import PeoplePicker from "@/components/PeoplePicker";
import ReportSheet from "@/components/ReportSheet";

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me, canAct } = useApp();
  const router = useRouter();
  const toast = useToast();
  const supabase = supabaseBrowser();
  const [conv, setConv] = useState<ConvWithMembers | null | undefined>(undefined);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [blockedNote, setBlockedNote] = useState("");
  const [menu, setMenu] = useState(false);
  const [adding, setAdding] = useState(false);
  const [toAdd, setToAdd] = useState<Map<string, Author>>(new Map());
  const [reporting, setReporting] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const markRead = useCallback(() => {
    supabase.from("conversation_members").update({ last_read_at: new Date().toISOString() })
      .match({ conversation_id: id, user_id: me.id }).then(() => {});
  }, [supabase, id, me.id]);

  const loadConv = useCallback(async () => {
    const { data } = await supabase.from("conversations").select(CONV_SELECT).eq("id", id).maybeSingle();
    setConv((data as unknown as ConvWithMembers) || null);
  }, [supabase, id]);

  useEffect(() => {
    loadConv();
    supabase.from("messages").select("*").eq("conversation_id", id).order("created_at", { ascending: false }).limit(200)
      .then(({ data }: { data: unknown[] | null }) => { setMsgs(((data || []) as Message[]).reverse()); markRead(); });

    const ch = supabase.channel("chat-" + id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload: { new: Message }) => {
          setMsgs((m) => (m.some((x) => x.id === payload.new.id) ? m : [...m, payload.new]));
          if (document.visibilityState === "visible") markRead();
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_members", filter: `conversation_id=eq.${id}` }, () => loadConv())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, id, loadConv, markRead]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const { data, error } = await supabase.from("messages").insert({ conversation_id: id, body }).select().single();
    setSending(false);
    if (error) {
      if (/row-level security/i.test(error.message)) setBlockedNote("You can't send messages here. One of you has blocked the other, or you've left this group.");
      else toast(friendlyError(error, "Couldn't send. Try again."));
      return;
    }
    setText("");
    setMsgs((m) => (m.some((x) => x.id === (data as Message).id) ? m : [...m, data as Message]));
  }

  async function deleteMsg(mid: string) {
    const { error } = await supabase.from("messages").delete().eq("id", mid);
    if (error) return toast(friendlyError(error));
    setMsgs((m) => m.filter((x) => x.id !== mid));
  }

  async function leave() {
    const { error } = await supabase.rpc("leave_conversation", { conv: id });
    if (error) return toast(friendlyError(error));
    router.replace("/messages");
  }

  async function addMembers() {
    if (!toAdd.size) return;
    const { error } = await supabase.rpc("add_group_members", { conv: id, p_members: [...toAdd.keys()] });
    if (error) return toast(friendlyError(error, "Couldn't add them."));
    setAdding(false); setToAdd(new Map()); loadConv(); toast("Added to the group");
  }

  if (conv === undefined) return <main className="wrap page"><div className="empty" style={{ marginTop: 20 }}>Loading...</div></main>;
  if (conv === null) return (
    <main className="wrap page">
      <div className="empty" style={{ marginTop: 20 }}>This conversation doesn't exist or you're not in it.
        <Link className="secondary" href="/messages">Back to messages</Link></div>
    </main>
  );

  const other = convOther(conv, me.id);
  const names = new Map(conv.members.map((m) => [m.user_id, m.profile?.name || "Student"]));
  const otherRead = other ? new Date(other.last_read_at) : null;
  const lastMine = [...msgs].reverse().find((m) => m.sender_id === me.id);

  return (
    <main className="wrap">
      <div className="chat-wrap">
        <div className="chat-head">
          <Link href="/messages" className="icon-btn" aria-label="All messages"><Icon name="back" /></Link>
          {conv.is_group
            ? <span className="av" style={{ background: "var(--teal-soft)", color: "var(--teal)" }}><Icon name="users" /></span>
            : <Avatar id={other?.user_id || id} name={other?.profile?.name} />}
          <div>
            {other ? <Link href={`/u/${other.user_id}`} style={{ textDecoration: "none" }}><b>{convTitle(conv, me.id)}</b></Link> : <b>{convTitle(conv, me.id)}</b>}
            <span className="meta">{conv.is_group ? `${conv.members.length} members` : "Private chat"}</span>
          </div>
          <button className="icon-btn" onClick={() => setMenu(true)} aria-label="Chat options"><Icon name="more" /></button>
        </div>

        <div className="chat" aria-live="polite">
          {msgs.length === 0 && <p className="note" style={{ textAlign: "center" }}>Say hi. Only the people in this chat can read these messages.</p>}
          {msgs.map((m) => {
            const mine = m.sender_id === me.id;
            return (
              <div key={m.id} className={`bub ${mine ? "me" : ""}`}>
                {conv.is_group && !mine && <span className="from">{names.get(m.sender_id) || "Former member"}</span>}
                {m.body}
                <small>
                  {timeAgo(m.created_at)}
                  {mine && m.id === lastMine?.id && otherRead && otherRead >= new Date(m.created_at) ? " · Seen" : ""}
                  {mine && <button className="ghost" style={{ color: "inherit", padding: 0, marginLeft: 8, fontSize: 11 }} onClick={() => deleteMsg(m.id)}>Delete</button>}
                </small>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {!canAct ? <div className="composer" style={{ justifyContent: "center" }}><a className="link-btn" href="/verify" style={{ margin: 0 }}><Icon name="lock" size={15} /> Verify your student account to send messages</a></div> : <div className="composer">
          {blockedNote && <p className="warn">{blockedNote}</p>}
          <div className="inline">
            <input value={text} maxLength={4000} placeholder="Write a message" aria-label="Write a message"
              onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button onClick={send} disabled={sending || !text.trim()} aria-label="Send message"><Icon name="send" size={16} /></button>
          </div>
        </div>}
      </div>

      {menu && (
        <Sheet title={convTitle(conv, me.id)} onClose={() => setMenu(false)}>
          {conv.is_group && <p className="note">Members: {conv.members.map((m) => m.profile?.name || "Student").join(", ")}</p>}
          <div className="menu">
            {other && <button onClick={() => router.push(`/u/${other.user_id}`)}>View profile, block</button>}
            {conv.is_group && <button onClick={() => { setMenu(false); setAdding(true); }}>Add people</button>}
            <button onClick={() => { setMenu(false); setReporting(true); }}>Report this chat</button>
            {conv.is_group && <button className="danger" onClick={leave}>Leave group</button>}
          </div>
        </Sheet>
      )}

      {adding && (
        <Sheet title="Add people" onClose={() => setAdding(false)}>
          <button className="primary" style={{ marginBottom: 12 }} onClick={addMembers} disabled={!toAdd.size}>Add {toAdd.size || ""} to group</button>
          <PeoplePicker multi selected={new Set(toAdd.keys())}
            onToggle={(p) => setToAdd((m) => { const n = new Map(m); if (n.has(p.id)) n.delete(p.id); else n.set(p.id, p); return n; })} />
        </Sheet>
      )}

      {reporting && <ReportSheet targetType={other ? "user" : "message"} targetId={other ? other.user_id : id} onClose={() => setReporting(false)} />}
    </main>
  );
}
