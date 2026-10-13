"use client";
import { supabaseBrowser } from "@/lib/supabase/client";
import { debateResult, ROUNDS } from "@/lib/debate";
import type { Space } from "@/lib/types";
import { useApp } from "../AppContext";
import { useToast } from "../Toast";

export interface Vote { user_id: string; phase: "before" | "after"; side: "a" | "b" }

const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function DebateVotes({ space, votes }: { space: Space; votes: Vote[] }) {
  const { me } = useApp();
  const toast = useToast();
  const before = { a: 0, b: 0 }, after = { a: 0, b: 0 };
  votes.forEach((v) => { (v.phase === "before" ? before : after)[v.side]++; });
  const myBefore = votes.find((v) => v.user_id === me.id && v.phase === "before")?.side;
  const myAfter = votes.find((v) => v.user_id === me.id && v.phase === "after")?.side;

  const ended = space.status === "ended";
  const beforeOpen = !ended && space.round_index <= 0;
  const afterOpen = space.round_index >= ROUNDS.length - 1 && space.round_index >= 0;
  const phase: "before" | "after" | null = beforeOpen ? "before" : afterOpen && !ended ? "after" : null;
  const showResult = ended || space.round_index >= ROUNDS.length;

  async function vote(side: "a" | "b") {
    if (!phase) return;
    const mine = phase === "before" ? myBefore : myAfter;
    const supabase = supabaseBrowser();
    const { error } = mine
      ? await supabase.from("debate_votes").update({ side }).match({ space_id: space.id, user_id: me.id, phase })
      : await supabase.from("debate_votes").insert({ space_id: space.id, phase, side });
    if (error) toast("Voting for this round has closed.");
  }

  const tally = phase === "after" ? after : before;
  const total = tally.a + tally.b;
  const shareA = total ? tally.a / total : 0.5;
  const mine = phase === "before" ? myBefore : myAfter;
  const result = debateResult({ before, after });

  return (
    <section className="card" style={{ marginTop: 12 }}>
      {phase ? (
        <>
          <b>{phase === "before" ? "Before the debate: which side are you on?" : "After hearing both sides: which side are you on now?"}</b>
          <div className="vote">
            <button className={`a ${mine === "a" ? "on" : ""}`} onClick={() => vote("a")} aria-pressed={mine === "a"}>
              <span>{total ? pct(shareA) : "0%"}</span>{space.side_a}
            </button>
            <button className={`b ${mine === "b" ? "on" : ""}`} onClick={() => vote("b")} aria-pressed={mine === "b"}>
              <span>{total ? pct(1 - shareA) : "0%"}</span>{space.side_b}
            </button>
          </div>
          <div className="split" aria-hidden="true"><div style={{ width: pct(shareA) }} /></div>
          <p className="meta" style={{ margin: "6px 0 0" }}>
            {total} {total === 1 ? "vote" : "votes"}. {phase === "before" ? "Voting closes when round 2 starts." : "Voting stays open until the moderator ends the debate."}
          </p>
        </>
      ) : showResult ? (
        <>
          <b>Result</b>
          {result.winner === null ? <p className="meta">No one voted after the debate, so there's no result.</p> : (
            <>
              <div className="title">
                {result.winner === "tie" ? "It's a tie" : `${result.winner === "a" ? space.side_a : space.side_b} wins`}
              </div>
              <p className="meta" style={{ margin: 0 }}>
                {space.side_a}: {pct(result.beforeA)} before, {pct(result.afterA)} after.{" "}
                {space.side_b}: {pct(1 - result.beforeA)} before, {pct(1 - result.afterA)} after.
                The winner is the side that changed the most minds.
              </p>
            </>
          )}
        </>
      ) : (
        <p className="meta" style={{ margin: 0 }}>
          {before.a + before.b} people voted before the debate. The final vote opens during closing statements.
        </p>
      )}
    </section>
  );
}
