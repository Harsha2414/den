"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AUTHOR_COLS, friendlyError } from "@/lib/format";
import type { Author } from "@/lib/types";
import { useApp } from "./AppContext";
import { useToast } from "./Toast";
import Avatar from "./Avatar";
import Icon from "./Icon";
import Sheet from "./Sheet";

/**
 * Unverified students can look around but not take part.
 * gate() returns true when the student may act; otherwise it opens the "Verify to join in" sheet.
 */
const GateCtx = createContext<{ gate: (what?: string) => boolean }>({ gate: () => true });

export function GateProvider({ children }: { children: ReactNode }) {
  const { canAct } = useApp();
  const [why, setWhy] = useState<string | null>(null);
  const gate = useCallback((what?: string) => {
    if (canAct) return true;
    setWhy(what || "take part");
    return false;
  }, [canAct]);
  return (
    <GateCtx.Provider value={{ gate }}>
      {children}
      {why && (
        <Sheet title="Verify to join in" onClose={() => setWhy(null)}>
          <div style={{ textAlign: "center", padding: "4px 4px 0" }}>
            <div className="lock-badge"><Icon name="lock" size={28} /></div>
            <p className="meta" style={{ fontSize: 15, margin: "0 0 18px" }}>
              Only verified students can {why} on Den. It keeps fake accounts and scams out. Most students are done in a minute.
            </p>
            <Link href="/verify" className="primary" onClick={() => setWhy(null)}>Get verified</Link>
            <button className="ghost" style={{ marginTop: 10, width: "100%", justifyContent: "center" }} onClick={() => setWhy(null)}>Not now</button>
          </div>
        </Sheet>
      )}
    </GateCtx.Provider>
  );
}

export const useGate = () => useContext(GateCtx).gate;

/** "Get your blue tick" card at the top of the feed. */
export function VerifyBanner() {
  const { access } = useApp();
  if (access.level === "full" || access.level === "banned") return null;
  const grace = access.level === "grace" && access.grace_until;
  return (
    <Link href="/verify" className="verify-banner">
      <span className="vb-icon"><Icon name="shield" size={24} /></span>
      <span className="vb-text">
        <b>{grace ? "Verify to keep posting" : "Get your blue tick"}</b>
        <span>{grace
          ? `From ${new Date(grace).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, only verified students can post, comment, like and message.`
          : "You can look around. Verify you're a student to post, comment, like and message."}</span>
        <em>Get verified <Icon name="chevRight" size={15} /></em>
      </span>
    </Link>
  );
}

type Req = { requester_id: string; status: string; requester: Author | null };

/** Classmates asking me to confirm I know them. */
export function VouchInbox() {
  const { me } = useApp();
  const toast = useToast();
  const supabase = supabaseBrowser();
  const [reqs, setReqs] = useState<Req[]>([]);
  const load = useCallback(async () => {
    const { data } = await supabase.from("vouches")
      .select(`requester_id,status, requester:profiles!vouches_requester_id_fkey(${AUTHOR_COLS})`)
      .eq("voucher_id", me.id).eq("status", "pending").limit(5);
    setReqs(((data || []) as unknown as Req[]).filter((r) => r.requester && !r.requester.verified));
  }, [supabase, me.id]);
  useEffect(() => { if (me.verified) load(); }, [load, me.verified]);

  async function answer(r: Req, a: "yes" | "no" | "unsure") {
    const { error } = await supabase.rpc("answer_vouch", { requester: r.requester_id, answer: a });
    if (error) return toast(friendlyError(error));
    setReqs((xs) => xs.filter((x) => x.requester_id !== r.requester_id));
    toast(a === "yes" ? `Thanks. You vouched for ${r.requester?.name}.` : "Thanks for answering");
  }

  if (!reqs.length) return null;
  return (
    <div className="vouch-stack">
      {reqs.map((r) => <VouchCard key={r.requester_id} who={r.requester!} onAnswer={(a) => answer(r, a)} />)}
    </div>
  );
}

export function VouchCard({ who, onAnswer, busy }: { who: Author; onAnswer: (a: "yes" | "no" | "unsure") => void; busy?: boolean }) {
  const { collegeName } = useApp();
  const first = who.name.split(" ")[0];
  return (
    <section className="vouch-card">
      <div className="vouch-kicker">Classmate check</div>
      <div className="vouch-who">
        <Avatar id={who.id} name={who.name} size="lg" />
        <div><b>{who.name}</b><span>{[who.branch, who.year].filter(Boolean).join(" · ")}</span></div>
      </div>
      <h3>Do you know {first} as a {collegeName(who.college_id) || "college"} student?</h3>
      <div className="vouch-btns">
        <button className="yes" disabled={busy} onClick={() => onAnswer("yes")}>Yes, I do</button>
        <button disabled={busy} onClick={() => onAnswer("unsure")}>Not sure</button>
        <button className="no" disabled={busy} onClick={() => onAnswer("no")}>No</button>
      </div>
      <p>Only say yes if you know them in person. If they turn out to be fake, you can&rsquo;t vouch for anyone for 90 days.</p>
    </section>
  );
}
