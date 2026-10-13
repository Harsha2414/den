"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  RoomAudioRenderer, StartAudio, useConnectionState, useLocalParticipant,
  useLocalParticipantPermissions, useParticipants, useRoomContext,
} from "@livekit/components-react";
import { ConnectionState, RoomEvent, type Participant } from "livekit-client";
import { ROUNDS, canSpeak } from "@/lib/debate";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Space, SpaceParticipant } from "@/lib/types";
import { useApp } from "../AppContext";
import { useToast } from "../Toast";
import Avatar from "../Avatar";
import Icon from "../Icon";
import Sheet from "../Sheet";
import DebateVotes, { type Vote } from "./DebateVotes";

export type Control = (body: Record<string, unknown>) => Promise<boolean>;

const UPDATE_ON = [
  RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.ActiveSpeakersChanged,
  RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.TrackPublished, RoomEvent.TrackUnpublished,
  RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.ParticipantPermissionsChanged,
];

function useClock(endsAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [endsAt]);
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000));
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function LiveRoom({ space, rows, votes, control, onLeave }: {
  space: Space; rows: SpaceParticipant[]; votes: Vote[]; control: Control; onLeave: () => void;
}) {
  const { me } = useApp();
  const toast = useToast();
  const room = useRoomContext();
  const conn = useConnectionState();
  const live = useParticipants({ updateOnlyOn: UPDATE_ON });
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const perms = useLocalParticipantPermissions();
  const canPublish = !!perms?.canPublish;
  const isHost = space.host_id === me.id;
  const debate = space.mode === "debate";
  const [menuFor, setMenuFor] = useState<SpaceParticipant | null>(null);
  const [handsOpen, setHandsOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const secondsLeft = useClock(debate ? space.round_ends_at : null);
  const autoSent = useRef<number | null>(null);

  const liveById = useMemo(() => new Map(live.map((p) => [p.identity, p])), [live]);
  const present = rows.filter((r) => !r.removed && liveById.has(r.user_id));
  const myRow = rows.find((r) => r.user_id === me.id);
  const host = present.find((r) => r.role === "host");
  const speakers = present.filter((r) => r.role === "speaker");
  const listeners = present.filter((r) => r.role === "listener");
  const hands = present.filter((r) => r.role === "listener" && r.hand_raised);
  const round = debate ? ROUNDS[space.round_index] : undefined;

  // The host's screen moves the debate on when the clock hits zero.
  useEffect(() => {
    if (!isHost || !debate || secondsLeft !== 0 || !round) return;
    if (autoSent.current === space.round_index) return;
    autoSent.current = space.round_index;
    control({ action: "next_round", auto: true });
  }, [isHost, debate, secondsLeft, round, space.round_index, control]);

  async function toggleMic() {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch {
      toast("Allow microphone access in your browser settings to speak.");
    }
  }

  async function toggleHand() {
    const next = !myRow?.hand_raised;
    const { error } = await supabaseBrowser().from("space_participants").update({ hand_raised: next }).match({ space_id: space.id, user_id: me.id });
    if (error) toast("Couldn't update your hand. Try again.");
    else if (next) toast("Hand raised. The host can invite you to speak.");
  }

  async function leave() {
    await room.disconnect();
    onLeave();
  }

  function seat(r: SpaceParticipant, label: string) {
    const lp: Participant | undefined = liveById.get(r.user_id);
    const talking = !!lp?.isSpeaking;
    const micOn = !!lp?.isMicrophoneEnabled;
    const allowed = canSpeak(space, r);
    const tappable = isHost && r.user_id !== me.id;
    const inner = (
      <>
        <Avatar id={r.user_id} name={r.profile?.name || lp?.name} speaking={talking} />
        <span className="nm">{r.user_id === me.id ? "You" : r.profile?.name || lp?.name || "Student"}</span>
        <span className="rl">
          {allowed ? <Icon name={micOn ? "mic" : "micOff"} size={12} /> : null}
          {r.hand_raised && <Icon name="hand" size={12} />}
          {label}
        </span>
      </>
    );
    return tappable
      ? <button key={r.user_id} className="seat" onClick={() => setMenuFor(r)} aria-label={`Options for ${r.profile?.name || "student"}`}>{inner}</button>
      : <div key={r.user_id} className="seat">{inner}</div>;
  }

  if (conn === ConnectionState.Connecting) return <div className="empty" style={{ marginTop: 16 }}>Joining the Space...</div>;

  return (
    <div style={{ paddingBottom: 90 }}>
      <RoomAudioRenderer />
      <StartAudio label="Tap to hear the Space" className="primary" />
      {conn === ConnectionState.Reconnecting && <p className="warn">Connection dropped. Reconnecting...</p>}

      {debate && (
        <div className="round" aria-live="polite">
          <div style={{ minWidth: 0 }}>
            <div className="meta">
              {space.round_index < 0 ? "Waiting to start" : round ? `Round ${space.round_index + 1} of ${ROUNDS.length}` : "Debate finished"}
            </div>
            <b style={{ fontSize: 17 }}>
              {space.round_index < 0 ? "Moderator introduces the debate"
                : round ? (round.side === "open" ? round.name : `${round.name}: ${round.side === "a" ? space.side_a : space.side_b}`)
                : "Final vote is open"}
            </b>
          </div>
          {round && secondsLeft !== null && <span className={`clock ${secondsLeft <= 10 ? "low" : ""}`}>{mmss(secondsLeft)}</span>}
          {isHost && space.round_index < ROUNDS.length && (
            <button className="secondary" onClick={() => control({ action: "next_round" })}>
              {space.round_index < 0 ? "Start round 1" : space.round_index === ROUNDS.length - 1 ? "Finish debate" : "Next round"}
            </button>
          )}
        </div>
      )}

      {debate ? (
        <>
          <div className="stage" style={{ gridTemplateColumns: "1fr" }}>
            {host && seat(host, "Moderator")}
          </div>
          <div className="teams">
            {(["a", "b"] as const).map((side) => {
              const team = speakers.filter((s) => s.side === side);
              const active = round && (round.side === side || round.side === "open");
              return (
                <div key={side} className={`team ${side} ${active ? "active" : ""}`}>
                  <h4>{side === "a" ? space.side_a : space.side_b}</h4>
                  {team.length ? <div className="stage">{team.map((r) => seat(r, "Debater"))}</div>
                    : <p className="meta" style={{ margin: 0 }}>{isHost ? "Tap someone in the audience to add them." : "No debaters yet."}</p>}
                </div>
              );
            })}
          </div>
          {speakers.some((s) => !s.side) && (
            <>
              <div className="label">Audience speakers</div>
              <div className="stage">{speakers.filter((s) => !s.side).map((r) => seat(r, "Speaker"))}</div>
            </>
          )}
          <DebateVotes space={space} votes={votes} />
        </>
      ) : (
        <>
          <div className="label">On stage</div>
          <div className="stage">
            {host && seat(host, "Host")}
            {speakers.map((r) => seat(r, "Speaker"))}
          </div>
        </>
      )}

      <div className="sec-head" style={{ marginTop: 12 }}>
        <h2 style={{ fontSize: 18 }}>Listening</h2><small>{listeners.length}</small>
      </div>
      {listeners.length === 0 ? <p className="meta">No listeners yet. Share this Space with your friends.</p>
        : <div className="stage">{listeners.map((r) => seat(r, r.hand_raised ? "Hand up" : "Listener"))}</div>}

      <div className="dock">
        <div className="wrap">
          {canPublish ? (
            <button className={`mic ${isMicrophoneEnabled ? "" : "off"}`} onClick={toggleMic} aria-pressed={isMicrophoneEnabled}>
              <Icon name={isMicrophoneEnabled ? "mic" : "micOff"} /> {isMicrophoneEnabled ? "Mute" : "Unmute"}
            </button>
          ) : myRow?.role === "listener" ? (
            <button className={`mic ${myRow.hand_raised ? "" : "off"}`} onClick={toggleHand} aria-pressed={!!myRow.hand_raised}>
              <Icon name="hand" /> {myRow.hand_raised ? "Hand raised" : "Raise hand"}
            </button>
          ) : (
            <span className="meta">{debate && myRow?.role === "speaker" ? "Your mic opens on your team's turn." : "Listening"}</span>
          )}
          {isHost && hands.length > 0 && (
            <button className="secondary" onClick={() => setHandsOpen(true)}><Icon name="hand" size={15} /> {hands.length} {hands.length === 1 ? "hand" : "hands"}</button>
          )}
          <span style={{ flex: 1 }} />
          {isHost ? (
            confirmEnd
              ? <button className="secondary danger" onClick={() => control({ action: "end" })}>Tap again to end for everyone</button>
              : <button className="secondary danger" onClick={() => { setConfirmEnd(true); setTimeout(() => setConfirmEnd(false), 4000); }}>End Space</button>
          ) : (
            <button className="secondary" onClick={leave}>Leave</button>
          )}
        </div>
      </div>

      {handsOpen && (
        <Sheet title="Raised hands" onClose={() => setHandsOpen(false)}>
          {hands.length === 0 ? <p className="meta">No hands raised right now.</p> : hands.map((r) => (
            <div key={r.user_id} className="pick">
              <Avatar id={r.user_id} name={r.profile?.name} />
              <div><b>{r.profile?.name || "Student"}</b><span>{r.profile?.branch}{r.profile?.year ? `, ${r.profile.year}` : ""}</span></div>
              <button className="secondary" onClick={() => control({ action: "invite", userId: r.user_id, side: null })}>Invite to speak</button>
              <button className="ghost" onClick={() => control({ action: "lower_hand", userId: r.user_id })} aria-label="Lower hand"><Icon name="x" /></button>
            </div>
          ))}
        </Sheet>
      )}

      {menuFor && (
        <Sheet title={menuFor.profile?.name || "Student"} onClose={() => setMenuFor(null)}>
          <div className="menu">
            {debate ? (
              <>
                {menuFor.side !== "a" && <button onClick={() => { control({ action: "invite", userId: menuFor.user_id, side: "a" }); setMenuFor(null); }}>Add as debater for {space.side_a}</button>}
                {menuFor.side !== "b" && <button onClick={() => { control({ action: "invite", userId: menuFor.user_id, side: "b" }); setMenuFor(null); }}>Add as debater for {space.side_b}</button>}
                {(menuFor.role !== "speaker" || menuFor.side) && <button onClick={() => { control({ action: "invite", userId: menuFor.user_id, side: null }); setMenuFor(null); }}>Invite to ask a question (audience round)</button>}
              </>
            ) : menuFor.role !== "speaker" && (
              <button onClick={() => { control({ action: "invite", userId: menuFor.user_id }); setMenuFor(null); }}>Invite to speak</button>
            )}
            {menuFor.role === "speaker" && <button onClick={() => { control({ action: "demote", userId: menuFor.user_id }); setMenuFor(null); }}>Move to listeners</button>}
            {menuFor.hand_raised && <button onClick={() => { control({ action: "lower_hand", userId: menuFor.user_id }); setMenuFor(null); }}>Lower hand</button>}
            <button className="danger" onClick={() => { control({ action: "remove", userId: menuFor.user_id }); setMenuFor(null); }}>Remove from Space</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
