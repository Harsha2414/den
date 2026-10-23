"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import { useAdmin } from "@/components/Shell";
import { ago } from "@/lib/format";

type Student = { id: string; name: string; branch: string; year: string; college_id: string; created_at: string; verified: boolean };
type Check = {
  id: string; user_id: string; college_id: string; name_on_card: string; photo_path: string | null; ai_verdict: string;
  ai_reading: Record<string, unknown>; status: string; created_at: string; student: Student | null;
};
type Flag = { user_id: string; no_count: number; yes_count: number; last_answer: string };
type Action = { id: string; action: string; note: string; created_at: string; admin: { name: string } | null; target: { name: string } | null };

const VERDICT: Record<string, [string, string]> = {
  match: ["AI approved", "ok"], unclear: ["Unclear", "wait"], mismatch: ["Mismatch", "bad"], error: ["AI couldn't read", "wait"],
};
const REASONS = ["Photo too blurry", "Name doesn't match", "Not a student ID", "Card has expired", "Looks edited", "Different college"];
const ACTION: Record<string, string> = {
  id_approved: "approved an ID card for", id_rejected: "rejected an ID card for", flag_cleared: "cleared the classmate flag on",
  tick_given: "gave a tick to", tick_removed: "removed the tick from", banned: "banned", banned_fake: "banned as fake", unbanned: "unbanned",
  report_removed: "removed reported content", report_dismissed: "dismissed a report",
};

export default function VerificationPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const { collegeName } = useAdmin();
  const tab = (useSearchParams().get("tab") || "cards") as "cards" | "flags" | "done";
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [photo, setPhoto] = useState("");
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [flags, setFlags] = useState<(Flag & { student: Student | null; nos: string[] })[] | null>(null);
  const [actions, setActions] = useState<Action[] | null>(null);

  const loadChecks = useCallback(async () => {
    const { data, error } = await supabase.from("id_checks")
      .select("*, student:profiles!id_checks_user_id_fkey(id,name,branch,year,college_id,created_at,verified)")
      .eq("status", "pending").order("created_at").limit(100);
    if (error) { setMsg(error.message); setChecks([]); return; }
    const rows = ((data || []) as Check[]).sort((a, b) => Number(a.ai_verdict === "match") - Number(b.ai_verdict === "match"));
    setChecks(rows);
    setSel((s) => (s && rows.some((r) => r.id === s) ? s : rows[0]?.id || null));
    if (rows.length) {
      const { data: em } = await supabase.rpc("admin_user_emails", { ids: rows.map((r) => r.user_id) });
      setEmails(Object.fromEntries(((em || []) as { id: string; email: string }[]).map((e) => [e.id, e.email])));
    }
  }, [supabase]);

  const loadFlags = useCallback(async () => {
    const { data } = await supabase.rpc("admin_vouch_flags");
    const fs = (data || []) as Flag[];
    if (!fs.length) return setFlags([]);
    const ids = fs.map((f) => f.user_id);
    const [{ data: ps }, { data: vs }] = await Promise.all([
      supabase.from("profiles").select("id,name,branch,year,college_id,created_at,verified").in("id", ids),
      supabase.from("vouches").select("requester_id,status, voucher:profiles!vouches_voucher_id_fkey(name)").in("requester_id", ids).eq("status", "no"),
    ]);
    const pm = new Map(((ps || []) as Student[]).map((p) => [p.id, p]));
    const nos = (vs || []) as unknown as { requester_id: string; voucher: { name: string } | null }[];
    setFlags(fs.map((f) => ({ ...f, student: pm.get(f.user_id) || null, nos: nos.filter((v) => v.requester_id === f.user_id).map((v) => v.voucher?.name || "?") })));
  }, [supabase]);

  const loadDone = useCallback(async () => {
    const { data } = await supabase.from("admin_actions")
      .select("id,action,note,created_at, admin:profiles!admin_actions_admin_id_fkey(name), target:profiles!admin_actions_target_user_fkey(name)")
      .order("created_at", { ascending: false }).limit(100);
    setActions((data || []) as unknown as Action[]);
  }, [supabase]);

  useEffect(() => {
    setMsg("");
    if (tab === "cards") loadChecks(); else if (tab === "flags") loadFlags(); else loadDone();
  }, [tab, loadChecks, loadFlags, loadDone]);

  const current = useMemo(() => checks?.find((c) => c.id === sel) || null, [checks, sel]);

  useEffect(() => {
    setPhoto(""); setReason("");
    if (!current?.photo_path) return;
    supabase.storage.from("id-cards").createSignedUrl(current.photo_path, 600)
      .then(({ data }: { data: { signedUrl: string } | null }) => setPhoto(data?.signedUrl || ""));
  }, [current, supabase]);

  async function decide(approve: boolean) {
    if (!current) return;
    if (!approve && !reason.trim()) { setMsg("Pick or type a reason. The student sees it."); return; }
    setBusy(true); setMsg("");
    const { error } = await supabase.rpc("admin_review_id", { check_id: current.id, approve, reason: approve ? "" : reason.trim() });
    if (error) { setBusy(false); setMsg(error.message); return; }
    if (current.photo_path) {
      const rm = await supabase.storage.from("id-cards").remove([current.photo_path]);
      if (!rm.error) await supabase.rpc("admin_photo_deleted", { check_id: current.id });
    }
    setBusy(false);
    setMsg(approve ? `Approved ${current.student?.name}. Photo deleted.` : `Rejected ${current.student?.name}. Photo deleted.`);
    await loadChecks(); router.refresh();
  }

  async function banFake(userId: string, name: string) {
    if (!window.confirm(`Ban ${name} as a fake account? Classmates who vouched for them lose vouching for 90 days.`)) return;
    const { error } = await supabase.rpc("admin_ban", { who: userId, reason: "Fake account", fake: true });
    if (error) return setMsg(error.message);
    setMsg(`${name} banned.`);
    if (tab === "flags") loadFlags(); else loadChecks();
    router.refresh();
  }

  async function clearFlag(userId: string) {
    const { error } = await supabase.rpc("admin_clear_flag", { who: userId });
    if (error) return setMsg(error.message);
    loadFlags(); router.refresh();
  }

  const tabLink = (t: string, label: string, count?: number) => (
    <button className={`chip ${tab === t ? "on" : ""}`} onClick={() => router.replace(`/verification${t === "cards" ? "" : `?tab=${t}`}`)}>
      {label}{count ? ` ${count}` : ""}
    </button>
  );
  const r = (current?.ai_reading || {}) as Record<string, string | boolean>;
  const yesNo = (v: unknown, good: boolean) => <span className={v === good ? "okc" : "badc"}>{v === good ? "✓" : "!"}</span>;

  return (
    <div className="page wide">
      <h1>Verification</h1>
      <div className="chips">{tabLink("cards", "ID cards", checks?.length)}{tabLink("flags", "Classmate flags", flags?.length)}{tabLink("done", "History")}</div>
      {msg && <p className="msg">{msg}</p>}

      {tab === "cards" && (checks === null ? <p className="muted">Loading...</p> : checks.length === 0 ? <div className="empty">No cards waiting. 🎉</div> : (
        <div className="split">
          <div className="queue">
            {checks.map((c) => (
              <button key={c.id} className={`qrow ${c.id === sel ? "on" : ""}`} onClick={() => setSel(c.id)}>
                <span className="av">{(c.student?.name || "?")[0]}</span>
                <span className="qtext"><b>{c.student?.name || "Student"}</b><small>{collegeName(c.college_id)} · {ago(c.created_at)}</small></span>
                <span className={`pill ${VERDICT[c.ai_verdict]?.[1]}`}>{VERDICT[c.ai_verdict]?.[0] || c.ai_verdict}</span>
              </button>
            ))}
          </div>
          {current && (
            <div className="detail">
              <div className="photo">{current.photo_path ? (photo ? <img src={photo} alt="Student ID card" /> : <span className="muted">Loading photo...</span>) : <span className="muted">Photo already deleted (older than 7 days).</span>}</div>
              <div className="facts">
                <div className="facts-head"><h2>{current.student?.name}</h2>
                  {current.student?.verified ? <span className="pill ok">Has tick now</span> : <span className="pill">No tick yet</span>}</div>
                <p className="muted">{collegeName(current.college_id)} · {current.student?.branch}, {current.student?.year} · {emails[current.user_id] || ""} · joined {ago(current.student?.created_at || current.created_at)}</p>
                <h3>What the AI read</h3>
                <dl>
                  <dt>Name typed by student</dt><dd>{current.name_on_card}</dd>
                  <dt>Name on card</dt><dd>{String(r.name || "—")} {"name_matches" in r && yesNo(r.name_matches, true)}</dd>
                  <dt>College on card</dt><dd>{String(r.college || "—")} {"belongs_to_college" in r && yesNo(r.belongs_to_college, true)}</dd>
                  <dt>Valid till</dt><dd>{String(r.valid_until || "—")} {"expired" in r && yesNo(r.expired, false)}</dd>
                  <dt>Edited or a screen?</dt><dd>{"looks_edited_or_screen" in r ? (r.looks_edited_or_screen ? "Possibly" : "No signs") : "—"} {"looks_edited_or_screen" in r && yesNo(r.looks_edited_or_screen, false)}</dd>
                  <dt>Student ID card?</dt><dd>{"is_student_id" in r ? (r.is_student_id ? "Yes" : "No") : "—"}</dd>
                  <dt>Card used before?</dt><dd>{r.used_before ? <span className="badc">Yes, by another account</span> : "No"}</dd>
                  <dt>AI confidence</dt><dd>{String(r.confidence || "—")}</dd>
                </dl>
                {r.notes ? <p className="note">AI note: {String(r.notes)}</p> : null}
                <div className="actions">
                  <button className="btn good" disabled={busy} onClick={() => decide(true)}>{current.student?.verified ? "Approve · keep tick" : "Approve · give tick"}</button>
                  <button className="btn bad" disabled={busy} onClick={() => decide(false)}>{current.student?.verified ? "Reject · remove tick" : "Reject"}</button>
                </div>
                <h3>Reject reason (the student sees this)</h3>
                <div className="chips">{REASONS.map((x) => <button key={x} className={`chip ${reason === x ? "on" : ""}`} onClick={() => setReason(x)}>{x}</button>)}</div>
                <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Or type a reason" maxLength={200} />
                <button className="link danger" onClick={() => banFake(current.user_id, current.student?.name || "this student")}>Ban as a fake account</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {tab === "flags" && (flags === null ? <p className="muted">Loading...</p> : flags.length === 0 ? <div className="empty">No flagged accounts.</div> : (
        <div className="list">
          {flags.map((f) => (
            <div key={f.user_id} className="row-card">
              <span className="av">{(f.student?.name || "?")[0]}</span>
              <div className="grow"><b>{f.student?.name}</b>
                <small>{collegeName(f.student?.college_id || "")} · {f.student?.branch}, {f.student?.year} · joined {ago(f.student?.created_at || "")}</small>
                <small><b className="badc">{f.no_count} said No</b> ({f.nos.join(", ")}) · {f.yes_count} said Yes</small></div>
              <button className="btn" onClick={() => clearFlag(f.user_id)}>Looks fine</button>
              <button className="btn bad" onClick={() => banFake(f.user_id, f.student?.name || "this student")}>Ban as fake</button>
            </div>
          ))}
        </div>
      ))}

      {tab === "done" && (actions === null ? <p className="muted">Loading...</p> : actions.length === 0 ? <div className="empty">Nothing yet.</div> : (
        <div className="list">
          {actions.map((a) => (
            <div key={a.id} className="log"><span className="muted">{ago(a.created_at)}</span>
              <span><b>{a.admin?.name || "An admin"}</b> {ACTION[a.action] || a.action} <b>{a.target?.name || ""}</b>{a.note ? <span className="muted"> · {a.note}</span> : null}</span></div>
          ))}
        </div>
      ))}
    </div>
  );
}
