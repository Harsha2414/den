"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/format";
import Sheet from "./Sheet";
import { useToast } from "./Toast";

const REASONS = ["Harassment or bullying", "Hate speech", "Sexual content", "Spam or scam", "Fake profile", "Sharing someone's private info", "Something else"];

export default function ReportSheet({ targetType, targetId, onClose }: { targetType: string; targetId: string; onClose: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const text = details.trim() ? `${reason}: ${details.trim()}` : reason;
    const { error } = await supabaseBrowser().from("reports").insert({ target_type: targetType, target_id: targetId, reason: text.slice(0, 1000) });
    setBusy(false);
    if (error) return setErr(friendlyError(error, "Couldn't send the report. Try again."));
    toast("Report sent. Thanks for keeping Campus Adda safe.");
    onClose();
  }

  return (
    <Sheet title="Report" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="note">Reports go to the Campus Adda team. The person you report won't see who reported them.</p>
        {err && <p className="err">{err}</p>}
        <div className="field">
          <label htmlFor="rp-reason">What's wrong?</label>
          <select id="rp-reason" value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</select>
        </div>
        <div className="field">
          <label htmlFor="rp-details">Details (optional)</label>
          <textarea id="rp-details" value={details} maxLength={800} onChange={(e) => setDetails(e.target.value)} />
        </div>
        <button className="primary" disabled={busy}>{busy ? "Sending..." : "Send report"}</button>
      </form>
    </Sheet>
  );
}
