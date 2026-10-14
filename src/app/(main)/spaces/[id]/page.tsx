"use client";
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LiveKitRoom } from "@livekit/components-react";
import { Room } from "livekit-client";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AUTHOR_COLS, friendlyError, timeAgo, whenLabel } from "@/lib/format";
import type { Space, SpaceParticipant } from "@/lib/types";
import { useApp } from "@/components/AppContext";
import { useToast } from "@/components/Toast";
import Icon, { VerifiedTick } from "@/components/Icon";
import ReportSheet from "@/components/ReportSheet";
import LiveRoom from "@/components/space/LiveRoom";
import DebateVotes, { type Vote } from "@/components/space/DebateVotes";

export default function SpacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me, collegeName } = useApp();
  const router = useRouter();
  const toast = useToast();
  const supabase = supabaseBrowser();
  const [space, setSpace] = useState<Space | null | undefined>(undefined);
  const [rows, setRows] = useState<SpaceParticipant[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [conn, setConn] = useState<{ token: string; url: string; room: Room } | null>(null);
  const [joining, setJoining] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadSpace = useCallback(async () => {
    const { data, error } = await supabase.from("spaces").select(`*, host:profiles!spaces_host_id_fkey(${AUTHOR_COLS})`).eq("id", id).maybeSingle();
    if (error) { setLoadError(friendlyError(error, "Couldn't load this Space. Check your connection and try again.")); return; }
    setLoadError("");
    setSpace((data as unknown as Space) || null);
  }, [supabase, id]);
  const loadRows = useCallback(async () => {
    const { data } = await supabase.from("space_participants").select(`*, profile:profiles!space_participants_user_id_fkey(${AUTHOR_COLS})`).eq("space_id", id);
    setRows((data || []) as unknown as SpaceParticipant[]);
  }, [supabase, id]);
  const loadVotes = useCallback(async () => {
    const { data } = await supabase.from("debate_votes").select("user_id,phase,side").eq("space_id", id);
    setVotes((data || []) as Vote[]);
  }, [supabase, id]);

  useEffect(() => {
    loadSpace(); loadRows(); loadVotes();
    const ch = supabase.channel("space-" + id)
      .on("postgres_changes", { event: "*", schema: "public", table: "spaces", filter: `id=eq.${id}` }, () => loadSpace())
      .on("postgres_changes", { event: "*", schema: "public", table: "space_participants", filter: `space_id=eq.${id}` }, () => loadRows())
      .on("postgres_changes", { event: "*", schema: "public", table: "debate_votes", filter: `space_id=eq.${id}` }, () => loadVotes())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, id, loadSpace, loadRows, loadVotes]);

  // Leave the audio room when the host ends the Space.
  useEffect(() => { if (space?.status === "ended") setConn(null); }, [space?.status]);
  // Close the audio connection whenever we leave the room or this page.
  useEffect(() => () => { conn?.room.disconnect(); }, [conn]);

  const control = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/spaces/${id}/control`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast(j.error || "That didn't work. Try again.");
      return false;
    }
    loadSpace(); loadRows();
    return true;
  }, [id, toast, loadSpace, loadRows]);

  async function join() {
    // Unlock sound now, while we're still inside the student's tap. Phones only allow
    // audio after a tap; mixing all voices through one unlocked audio channel means
    // nobody has to tap again when others start speaking.
    const room = new Room({ webAudioMix: true });
    room.startAudio().catch(() => {});
    setJoining(true);
    const res = await fetch(`/api/spaces/${id}/token`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    setJoining(false);
    if (!res.ok) return toast(j.error || "Couldn't join. Try again.");
    setConn({ token: j.token, url: j.url, room });
    loadRows();
  }

  async function remove() {
    const { error } = await supabase.from("spaces").delete().eq("id", id);
    if (error) return toast(friendlyError(error, "Couldn't delete this Space."));
    router.replace("/spaces");
  }

  if (loadError && !space) return (
    <main className="wrap page"><div className="empty" style={{ marginTop: 20 }}>{loadError}
      <button className="secondary" onClick={() => loadSpace()}>Try again</button></div></main>
  );
  if (space === undefined) return <main className="wrap page"><div className="empty" style={{ marginTop: 20 }}>Loading...</div></main>;
  if (space === null) return (
    <main className="wrap page"><div className="empty" style={{ marginTop: 20 }}>This Space doesn't exist or is only open to another college.
      <Link className="secondary" href="/spaces">See all Spaces</Link></div></main>
  );

  const isHost = space.host_id === me.id;
  const debate = space.mode === "debate";

  return (
    <main className="wrap page">
      <div className="row" style={{ marginTop: 12, justifyContent: "space-between" }}>
        <Link href="/spaces" className="ghost"><Icon name="back" size={16} /> Spaces</Link>
        {!isHost && <button className="ghost" onClick={() => setReporting(true)}><Icon name="flag" size={15} /> Report</button>}
      </div>

      <div className="row" style={{ marginTop: 6 }}>
        {space.status === "live" && <span className="tag live">LIVE</span>}
        {space.status === "scheduled" && <span className="tag wait">{space.scheduled_for ? whenLabel(space.scheduled_for) : "Not started"}</span>}
        {space.status === "ended" && <span className="tag">Ended {timeAgo(space.ended_at)}</span>}
        <span className="tag">{debate ? "Debate" : "Space"}</span>
        {space.visibility === "college" && <span className="tag ok">Campus only</span>}
      </div>
      <h1 className="title" style={{ fontSize: 26 }}>{space.title}</h1>
      {debate && <div className="meta"><b>{space.side_a}</b> vs <b>{space.side_b}</b></div>}
      <div className="meta">
        {debate ? "Moderated" : "Hosted"} by <Link href={`/u/${space.host_id}`}>{space.host?.name || "a student"}</Link>{space.host?.verified && <VerifiedTick />}
        {collegeName(space.college_id) ? `, ${collegeName(space.college_id)}` : ""}
      </div>
      {space.description && <p className="body">{space.description}</p>}

      {space.status === "scheduled" && (
        <div className="card" style={{ marginTop: 12 }}>
          {isHost ? (
            <>
              <p style={{ marginTop: 0 }}>Your {debate ? "debate" : "Space"} {space.scheduled_for ? `is scheduled for ${whenLabel(space.scheduled_for)}` : "hasn't started"}. Start it whenever you're ready.</p>
              <div className="row">
                <button className="primary" style={{ width: "auto", padding: "0 22px" }} onClick={() => control({ action: "start" })}><Icon name="radio" /> Go live</button>
                <button className="secondary danger" onClick={() => (confirmDelete ? remove() : setConfirmDelete(true))}>{confirmDelete ? "Tap again to delete" : "Delete"}</button>
              </div>
            </>
          ) : (
            <p style={{ margin: 0 }}>This {debate ? "debate" : "Space"} hasn't started yet. {space.scheduled_for ? `It's planned for ${whenLabel(space.scheduled_for)}. ` : ""}Come back then; it will show as LIVE on your home page.</p>
          )}
          {debate && <DebateVotes space={space} votes={votes} />}
        </div>
      )}

      {space.status === "live" && !conn && (
        <div className="card" style={{ marginTop: 12 }}>
          <p style={{ marginTop: 0 }}>{rows.filter((r) => !r.removed).length} people have joined. {isHost ? "Rejoin to keep hosting." : "You'll join as a listener. Raise your hand to ask to speak."}</p>
          <button className="primary" onClick={join} disabled={joining}><Icon name="radio" /> {joining ? "Joining..." : isHost ? "Rejoin as host" : "Join and listen"}</button>
          <p className="note" style={{ margin: "10px 0 0" }}>Spaces are live audio. Be respectful: hosts can remove people, and you can report anything that breaks the rules.</p>
        </div>
      )}

      {space.status === "live" && conn && (
        <LiveKitRoom room={conn.room} serverUrl={conn.url} token={conn.token} connect audio={false} video={false}
          onDisconnected={() => setConn(null)}
          onError={() => toast("Voice connection problem. Rejoin to try again.")}>
          <LiveRoom space={space} rows={rows} votes={votes} control={control} onLeave={() => setConn(null)} />
        </LiveKitRoom>
      )}

      {space.status === "ended" && (
        <div className="card" style={{ marginTop: 12 }}>
          <p style={{ margin: 0 }}>This {debate ? "debate" : "Space"} ended {timeAgo(space.ended_at)}. {rows.length} people took part.</p>
          {debate && <DebateVotes space={space} votes={votes} />}
        </div>
      )}

      {reporting && <ReportSheet targetType="space" targetId={space.id} onClose={() => setReporting(false)} />}
    </main>
  );
}
