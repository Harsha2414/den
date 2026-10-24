"use client";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/client";
import { friendlyError, timeAgo } from "@/lib/format";
import { CONV_SELECT, convOther, convTitle, type ConvWithMembers } from "@/lib/chat";
import type { Author, Message } from "@/lib/types";
import { useApp } from "@/components/AppContext";
import { useToast } from "@/components/Toast";
import { useGate } from "@/components/Gate";
import { OnlineDot, useOnline } from "@/components/Presence";
import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";
import Sheet from "@/components/Sheet";
import PeoplePicker from "@/components/PeoplePicker";
import ReportSheet from "@/components/ReportSheet";
import EmojiPicker from "@/components/EmojiPicker";
import { MediaPicker, MediaView } from "@/components/Media";
import type { Media } from "@/lib/media";

const PAGE = 40;
const START = 1_000_000; // list index of the newest message; older pages are added in front of it
const QUICK = ["❤️", "😂", "😮", "😢", "👍", "🔥"];
type Reaction = { message_id: string; user_id: string; emoji: string };

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me, canAct } = useApp();
  const router = useRouter();
  const toast = useToast();
  const gate = useGate();
  const online = useOnline();
  const supabase = supabaseBrowser();
  const [conv, setConv] = useState<ConvWithMembers | null | undefined>(undefined);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [firstIndex, setFirstIndex] = useState(START);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [typing, setTyping] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());
  const [picked, setPicked] = useState<string | null>(null);
  const [emojiFor, setEmojiFor] = useState<"composer" | string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState<Media[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [blockedNote, setBlockedNote] = useState("");
  const [menu, setMenu] = useState(false);
  const [adding, setAdding] = useState(false);
  const [toAdd, setToAdd] = useState<Map<string, Author>>(new Map());
  const [reporting, setReporting] = useState(false);
  const list = useRef<VirtuosoHandle>(null);
  const channel = useRef<RealtimeChannel | null>(null);
  const lastTypingSent = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const idsRef = useRef<Set<string>>(new Set());
  idsRef.current = new Set(msgs.map((m) => m.id));
  const latestRef = useRef<string | null>(null);
  const loadedRef = useRef(false);
  loadedRef.current = loaded;
  latestRef.current = msgs.length ? msgs[msgs.length - 1].created_at : null;

  const markRead = useCallback(() => {
    supabase.from("conversation_members").update({ last_read_at: new Date().toISOString() })
      .match({ conversation_id: id, user_id: me.id }).then(() => {});
  }, [supabase, id, me.id]);

  const loadConv = useCallback(async () => {
    const { data } = await supabase.from("conversations").select(CONV_SELECT).eq("id", id).maybeSingle();
    setConv((data as unknown as ConvWithMembers) || null);
  }, [supabase, id]);

  const loadReactions = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const { data } = await supabase.from("message_reactions").select("message_id,user_id,emoji").in("message_id", ids);
    const got = (data || []) as Reaction[];
    setReactions((rs) => [...rs.filter((r) => !ids.includes(r.message_id)), ...got]);
  }, [supabase]);

  useEffect(() => {
    loadConv();
    supabase.from("messages").select("*").eq("conversation_id", id).order("created_at", { ascending: false }).limit(PAGE)
      .then(({ data }: { data: unknown[] | null }) => {
        const rows = ((data || []) as Message[]).reverse();
        setMsgs(rows); setFirstIndex(START - rows.length); setHasOlder(rows.length === PAGE); setLoaded(true);
        loadReactions(rows.map((m) => m.id));
        markRead();
      });

    const addNew = (rows: Message[]) => {
      if (!rows.length) return;
      setMsgs((m) => {
        const have = new Set(m.map((x) => x.id));
        const fresh = rows.filter((r) => !have.has(r.id));
        return fresh.length ? [...m, ...fresh].sort((a, b) => a.created_at.localeCompare(b.created_at)) : m;
      });
      if (document.visibilityState === "visible") markRead();
    };

    // Safety net: fetch anything newer than what's on screen (after reconnecting, coming back to the tab, or by polling).
    const catchUp = async () => {
      if (!loadedRef.current) return;
      const since = latestRef.current;
      let q = supabase.from("messages").select("*").eq("conversation_id", id).order("created_at", { ascending: true }).limit(100);
      if (since) q = q.gt("created_at", since);
      const { data } = await q;
      addNew((data || []) as Message[]);
    };

    // 1. Messages and members: its own connection, so nothing else can break it.
    let poll: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => { if (!poll) poll = setInterval(catchUp, 4000); };
    const stopPolling = () => { if (poll) { clearInterval(poll); poll = null; } };
    const msgCh = supabase.channel("chat-msgs-" + id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload: { new: Message }) => {
          addNew([payload.new]);
          setTyping((t) => { const n = { ...t }; delete n[payload.new.sender_id]; return n; });
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_members", filter: `conversation_id=eq.${id}` }, () => loadConv())
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") { stopPolling(); catchUp(); }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") startPolling();
      });

    // 2. Deleted messages and reactions: a separate connection (reactions need migration 0007).
    const extraCh = supabase.channel("chat-extra-" + id)
      // Delete events can't be filtered by chat; ignore ones that aren't on screen.
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" },
        (payload: { old: { id: string } }) => { if (idsRef.current.has(payload.old.id)) setMsgs((m) => m.filter((x) => x.id !== payload.old.id)); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_reactions" }, (payload: { new: Reaction }) => {
        if (!idsRef.current.has(payload.new.message_id)) return;
        setReactions((rs) => rs.some((r) => r.message_id === payload.new.message_id && r.user_id === payload.new.user_id && r.emoji === payload.new.emoji) ? rs : [...rs, payload.new]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "message_reactions" }, (payload: { old: Reaction }) => {
        setReactions((rs) => rs.filter((r) => !(r.message_id === payload.old.message_id && r.user_id === payload.old.user_id && r.emoji === payload.old.emoji)));
      })
      .subscribe();

    // 3. Typing: a live broadcast, not stored anywhere.
    const typeCh = supabase.channel("chat-typing-" + id)
      .on("broadcast", { event: "typing" }, ({ payload }: { payload: { user: string; stop?: boolean } }) => {
        if (payload.user === me.id) return;
        setTyping((t) => { const n = { ...t }; if (payload.stop) delete n[payload.user]; else n[payload.user] = Date.now(); return n; });
      })
      .subscribe();
    channel.current = typeCh;

    const onBack = () => { if (document.visibilityState === "visible") catchUp(); };
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("online", catchUp);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onBack);
      window.removeEventListener("online", catchUp);
      supabase.removeChannel(msgCh); supabase.removeChannel(extraCh); supabase.removeChannel(typeCh);
      channel.current = null;
    };
  }, [supabase, id, me.id, loadConv, markRead, loadReactions]);

  // "typing…" disappears after 4 seconds without a new keystroke.
  useEffect(() => {
    if (!Object.keys(typing).length) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [typing]);
  const typers = Object.entries(typing).filter(([, at]) => now - at < 4000).map(([u]) => u);

  const loadOlder = useCallback(async () => {
    if (!hasOlder || loadingOlder || !msgs.length) return;
    setLoadingOlder(true);
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", id)
      .lt("created_at", msgs[0].created_at).order("created_at", { ascending: false }).limit(PAGE);
    const rows = ((data || []) as Message[]).reverse();
    setMsgs((m) => [...rows.filter((r) => !m.some((x) => x.id === r.id)), ...m]);
    setFirstIndex((f) => f - rows.length);
    setHasOlder(rows.length === PAGE);
    setLoadingOlder(false);
    loadReactions(rows.map((r) => r.id));
  }, [hasOlder, loadingOlder, msgs, supabase, id, loadReactions]);

  function onType(v: string) {
    setText(v);
    const t = Date.now();
    if (v && t - lastTypingSent.current > 2500) {
      lastTypingSent.current = t;
      channel.current?.send({ type: "broadcast", event: "typing", payload: { user: me.id } });
    }
  }

  async function send() {
    const body = text.trim();
    if ((!body && !files.length) || sending || uploading) return;
    setSending(true);
    const { data, error } = await supabase.from("messages").insert({ conversation_id: id, body, attachments: files }).select().single();
    setSending(false);
    if (error) {
      if (/row-level security/i.test(error.message)) setBlockedNote("You can't send messages here. One of you has blocked the other, or you've left this group.");
      else toast(friendlyError(error, "Couldn't send. Try again."));
      return;
    }
    setText(""); setFiles([]); setAttaching(false);
    lastTypingSent.current = 0;
    channel.current?.send({ type: "broadcast", event: "typing", payload: { user: me.id, stop: true } });
    setMsgs((m) => (m.some((x) => x.id === (data as Message).id) ? m : [...m, data as Message]));
    requestAnimationFrame(() => list.current?.scrollToIndex({ index: "LAST", behavior: "smooth" }));
  }

  async function deleteMsg(mid: string) {
    const msg = msgs.find((x) => x.id === mid);
    setPicked(null);
    const { error } = await supabase.from("messages").delete().eq("id", mid);
    if (error) return toast(friendlyError(error));
    const paths = (msg?.attachments || []).map((a) => a.path).filter((p) => p.startsWith(`${me.id}/`));
    if (paths.length) await supabase.storage.from("chat").remove(paths);
    setMsgs((m) => m.filter((x) => x.id !== mid));
  }

  async function react(mid: string, emoji: string) {
    setPicked(null); setEmojiFor(null);
    if (!gate("react to messages")) return;
    const mine = reactions.some((r) => r.message_id === mid && r.user_id === me.id && r.emoji === emoji);
    if (mine) {
      setReactions((rs) => rs.filter((r) => !(r.message_id === mid && r.user_id === me.id && r.emoji === emoji)));
      const { error } = await supabase.from("message_reactions").delete().match({ message_id: mid, user_id: me.id, emoji });
      if (error) toast(friendlyError(error));
    } else {
      setReactions((rs) => [...rs, { message_id: mid, user_id: me.id, emoji }]);
      const { error } = await supabase.from("message_reactions").insert({ message_id: mid, emoji });
      if (error) { setReactions((rs) => rs.filter((r) => !(r.message_id === mid && r.user_id === me.id && r.emoji === emoji))); toast(friendlyError(error)); }
    }
  }

  function addEmojiToText(e: string) {
    const el = inputRef.current;
    const at = el?.selectionStart ?? text.length;
    const next = text.slice(0, at) + e + text.slice(at);
    setText(next);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + e.length, at + e.length); });
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

  const byMsg = useMemo(() => {
    const m = new Map<string, { emoji: string; n: number; mine: boolean; who: string[] }[]>();
    reactions.forEach((r) => {
      const arr = m.get(r.message_id) || [];
      const e = arr.find((x) => x.emoji === r.emoji);
      if (e) { e.n++; e.who.push(r.user_id); if (r.user_id === me.id) e.mine = true; }
      else arr.push({ emoji: r.emoji, n: 1, mine: r.user_id === me.id, who: [r.user_id] });
      m.set(r.message_id, arr);
    });
    return m;
  }, [reactions, me.id]);

  if (conv === undefined) return <main className="wrap page"><div className="empty" style={{ marginTop: 20 }}>Loading...</div></main>;
  if (conv === null) return (
    <main className="wrap page">
      <div className="empty" style={{ marginTop: 20 }}>This conversation doesn&rsquo;t exist or you&rsquo;re not in it.
        <Link className="secondary" href="/messages">Back to messages</Link></div>
    </main>
  );

  const other = convOther(conv, me.id);
  const names = new Map(conv.members.map((m) => [m.user_id, m.profile?.name || "Student"]));
  const otherRead = other ? new Date(other.last_read_at) : null;
  const lastMine = [...msgs].reverse().find((m) => m.sender_id === me.id);
  const status = typers.length
    ? (conv.is_group ? `${typers.map((u) => (names.get(u) || "Someone").split(" ")[0]).join(", ")} typing…` : "typing…")
    : conv.is_group ? `${conv.members.length} members${conv.members.some((m) => m.user_id !== me.id && online.has(m.user_id)) ? " · some online" : ""}`
    : other && online.has(other.user_id) ? "Online" : "Private chat";

  return (
    <main className="wrap">
      <div className="chat-wrap">
        <div className="chat-head">
          <Link href="/messages" className="icon-btn" aria-label="All messages"><Icon name="back" /></Link>
          {conv.is_group
            ? <span className="av" style={{ background: "var(--teal-soft)", color: "var(--teal)" }}><Icon name="users" /></span>
            : <OnlineDot id={other?.user_id || ""}><Avatar id={other?.user_id || id} name={other?.profile?.name} /></OnlineDot>}
          <div>
            {other ? <Link href={`/u/${other.user_id}`} style={{ textDecoration: "none" }}><b>{convTitle(conv, me.id)}</b></Link> : <b>{convTitle(conv, me.id)}</b>}
            <span className={`meta ${typers.length ? "typing-now" : ""}`}>{status}</span>
          </div>
          <button className="icon-btn" onClick={() => setMenu(true)} aria-label="Chat options"><Icon name="more" /></button>
        </div>

        <div className="chat" aria-live="polite" onClick={() => picked && setPicked(null)}>
          {loaded && msgs.length === 0 ? <p className="note" style={{ textAlign: "center", marginTop: 16 }}>Say hi. Only the people in this chat can read these messages.</p> : (
            <Virtuoso
              ref={list}
              style={{ height: "100%" }}
              data={msgs}
              firstItemIndex={firstIndex}
              initialTopMostItemIndex={Math.max(0, msgs.length - 1)}
              computeItemKey={(_, m) => m.id}
              startReached={loadOlder}
              followOutput={(atBottom) => (atBottom ? "smooth" : false)}
              alignToBottom
              increaseViewportBy={{ top: 800, bottom: 400 }}
              components={{
                Header: () => loadingOlder ? <div className="more-loading"><span className="spinner" /></div>
                  : !hasOlder && msgs.length >= PAGE ? <p className="end-note">Start of your chat</p> : null,
                Footer: () => typers.length ? <div className="bub-row"><div className="bub typing-bub" aria-label="Typing"><i /><i /><i /></div></div> : <div style={{ height: 4 }} />,
              }}
              itemContent={(_, m) => {
                const mine = m.sender_id === me.id;
                const rs = byMsg.get(m.id) || [];
                return (
                  <div className={`bub-row ${mine ? "me" : ""}`}>
                    {picked === m.id && (
                      <div className="react-bar" onClick={(e) => e.stopPropagation()}>
                        {QUICK.map((e) => <button key={e} onClick={() => react(m.id, e)} aria-label={`React ${e}`}>{e}</button>)}
                        <button className="more" onClick={() => setEmojiFor(m.id)} aria-label="More emoji"><Icon name="plus" size={18} /></button>
                        {mine && <button className="del" onClick={() => deleteMsg(m.id)} aria-label="Delete message"><Icon name="trash" size={16} /></button>}
                      </div>
                    )}
                    <div className={`bub ${mine ? "me" : ""} ${picked === m.id ? "picked" : ""}`}
                      onClick={(e) => { e.stopPropagation(); setPicked(picked === m.id ? null : m.id); }}
                      onDoubleClick={(e) => { e.stopPropagation(); react(m.id, "❤️"); }}>
                      {conv.is_group && !mine && <span className="from">{names.get(m.sender_id) || "Former member"}</span>}
                      {!!m.attachments?.length && <MediaView items={m.attachments} bucket="chat" className="bub-media" />}
                      {m.body}
                      <small>
                        {timeAgo(m.created_at)}
                        {mine && m.id === lastMine?.id && otherRead && otherRead >= new Date(m.created_at) ? " · Seen" : ""}
                      </small>
                    </div>
                    {rs.length > 0 && (
                      <div className="reacts">
                        {rs.map((r) => (
                          <button key={r.emoji} className={r.mine ? "mine" : ""} onClick={() => react(m.id, r.emoji)}
                            title={r.who.map((u) => (u === me.id ? "You" : names.get(u) || "Student")).join(", ")}>
                            {r.emoji}{r.n > 1 ? ` ${r.n}` : ""}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }}
            />
          )}
        </div>

        {!canAct ? <div className="composer" style={{ justifyContent: "center" }}><a className="link-btn" href="/verify" style={{ margin: 0 }}><Icon name="lock" size={15} /> Verify your student account to send messages</a></div> : <div className="composer">
          {blockedNote && <p className="warn">{blockedNote}</p>}
          {(attaching || files.length > 0) && (
            <MediaPicker accept="any" max={6} bucket="chat" folder={`${me.id}/${id}`} value={files} onChange={setFiles} onBusy={setUploading} compact />
          )}
          <div className="inline">
            <button type="button" className="attach-btn" onClick={() => setAttaching((v) => !v)} aria-label="Add photos, videos or files" aria-pressed={attaching}><Icon name="clip" size={18} /></button>
            <button type="button" className="attach-btn" onClick={() => setEmojiFor("composer")} aria-label="Add emoji"><Icon name="smile" size={18} /></button>
            <input ref={inputRef} value={text} maxLength={4000} placeholder="Write a message" aria-label="Write a message"
              onChange={(e) => onType(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button onClick={send} disabled={sending || uploading || (!text.trim() && !files.length)} aria-label="Send message"><Icon name="send" size={16} /></button>
          </div>
        </div>}
      </div>

      {emojiFor && (
        <EmojiPicker title={emojiFor === "composer" ? "Add emoji" : "React"} onClose={() => setEmojiFor(null)}
          onPick={(e) => { if (emojiFor === "composer") addEmojiToText(e); else react(emojiFor, e); }} />
      )}

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
