"use client";
import { useGate } from "@/components/Gate";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/format";
import type { Profile } from "@/lib/types";
import { useApp } from "@/components/AppContext";
import { useToast } from "@/components/Toast";
import Avatar from "@/components/Avatar";
import Icon, { VerifiedTick } from "@/components/Icon";
import ReportSheet from "@/components/ReportSheet";

export default function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me, collegeName } = useApp();
  const gate = useGate();
  const router = useRouter();
  const toast = useToast();
  const supabase = supabaseBrowser();
  const [p, setP] = useState<Profile | null | undefined>(undefined);
  const [isBlocked, setIsBlocked] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (id === me.id) { router.replace("/me"); return; }
    supabase.from("profiles").select("id,name,college_id,branch,year,bio,verified,is_admin").eq("id", id).maybeSingle()
      .then(({ data }: { data: unknown }) => setP((data as Profile) || null));
    supabase.from("blocks").select("blocked_id").eq("blocked_id", id).maybeSingle()
      .then(({ data }: { data: unknown }) => setIsBlocked(!!data));
  }, [id, me.id, router, supabase]);

  async function message() {
    if (!gate("message students")) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("start_dm", { other: id });
    setBusy(false);
    if (error) return toast(friendlyError(error, "Couldn't open a chat."));
    router.push(`/messages/${data}`);
  }

  async function toggleBlock() {
    if (!isBlocked && !confirmBlock) { setConfirmBlock(true); return; }
    setConfirmBlock(false);
    const { error } = isBlocked
      ? await supabase.from("blocks").delete().eq("blocked_id", id)
      : await supabase.from("blocks").insert({ blocked_id: id });
    if (error) return toast(friendlyError(error));
    setIsBlocked(!isBlocked);
    toast(isBlocked ? "Unblocked" : "Blocked. They can't message you now.");
  }

  if (p === undefined) return <main className="wrap page"><div className="empty" style={{ marginTop: 20 }}>Loading...</div></main>;
  if (p === null) return <main className="wrap page"><div className="empty" style={{ marginTop: 20 }}>This student's profile doesn't exist anymore.</div></main>;

  return (
    <main className="wrap page">
      <button className="ghost" style={{ marginTop: 12 }} onClick={() => router.back()}><Icon name="back" size={16} /> Back</button>
      <div className="prof">
        <Avatar id={p.id} name={p.name} size="lg" />
        <div>
          <h1>{p.name}{p.verified && <VerifiedTick />}</h1>
          <div className="meta">{p.branch}, {p.year}</div>
          <div className="meta">{collegeName(p.college_id)}</div>
        </div>
      </div>
      {p.bio && <p className="body">{p.bio}</p>}
      <div className="row">
        {!isBlocked && <button className="primary" style={{ width: "auto", padding: "0 20px" }} onClick={message} disabled={busy}><Icon name="chat" /> Message</button>}
        <button className={`secondary ${isBlocked ? "" : "danger"}`} onClick={toggleBlock}>
          {isBlocked ? "Unblock" : confirmBlock ? "Tap again to block" : "Block"}
        </button>
        <button className="ghost" onClick={() => setReporting(true)}><Icon name="flag" size={15} /> Report</button>
      </div>
      {reporting && <ReportSheet targetType="user" targetId={p.id} onClose={() => setReporting(false)} />}
    </main>
  );
}
