"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";
import { useAdmin } from "@/components/Shell";
import { ago } from "@/lib/format";

type Report = {
  id: string; target_type: string; target_id: string; reason: string; status: string; created_at: string;
  reporter_id: string; reporter_name: string | null; author_id: string | null; author_name: string | null; preview: string | null; gone: boolean;
};
const KIND: Record<string, string> = {
  post: "Post", comment: "Comment", note: "Notes", placement: "Placement story", listing: "Market listing", event: "Event",
  message: "Private message", space: "Space", article: "Article", article_comment: "Article comment", user: "Profile",
};

/** Where to see the thing in Den, when it has its own page. */
function denPath(r: Report): string | null {
  switch (r.target_type) {
    case "event": return `/events/${r.target_id}`;
    case "article": return `/articles/${r.target_id}`;
    case "space": return `/spaces/${r.target_id}`;
    case "user": return `/u/${r.target_id}`;
    default: return r.author_id ? `/u/${r.author_id}` : null;
  }
}

export default function ReportsPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const { denUrl } = useAdmin();
  const [open, setOpen] = useState(true);
  const [list, setList] = useState<Report[] | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setList(null);
    const { data, error } = await supabase.rpc("admin_reports", { only_open: open });
    if (error) { setMsg(error.message); setList([]); return; }
    setList((data || []) as Report[]);
  }, [supabase, open]);
  useEffect(() => { load(); }, [load]);

  async function resolve(r: Report, remove: boolean) {
    if (remove && !window.confirm(`Delete this ${KIND[r.target_type]?.toLowerCase() || "item"} for everyone?`)) return;
    setBusy(r.id); setMsg("");
    const { error } = await supabase.rpc("admin_resolve_report", { report: r.id, remove });
    setBusy(null);
    if (error) return setMsg(error.message);
    setMsg(remove ? "Removed, and the report is closed." : "Report dismissed.");
    load(); router.refresh();
  }

  async function ban(r: Report) {
    if (!r.author_id) return;
    const reason = window.prompt(`Ban ${r.author_name}? Type a short reason (the log keeps it):`, r.reason.slice(0, 80));
    if (reason === null) return;
    setBusy(r.id);
    const { error } = await supabase.rpc("admin_ban", { who: r.author_id, reason, fake: false });
    if (!error) await supabase.rpc("admin_resolve_report", { report: r.id, remove: r.target_type !== "user" && !r.gone });
    setBusy(null);
    if (error) return setMsg(error.message);
    setMsg(`${r.author_name} is banned.`); load(); router.refresh();
  }

  // Several reports about the same thing show as one card.
  const groups = new Map<string, Report[]>();
  (list || []).forEach((r) => { const k = `${r.target_type}:${r.target_id}`; groups.set(k, [...(groups.get(k) || []), r]); });

  return (
    <div className="page">
      <h1>Reports</h1>
      <div className="chips">
        <button className={`chip ${open ? "on" : ""}`} onClick={() => setOpen(true)}>Open</button>
        <button className={`chip ${!open ? "on" : ""}`} onClick={() => setOpen(false)}>All</button>
      </div>
      {msg && <p className="msg">{msg}</p>}
      {list === null ? <p className="muted">Loading...</p> : groups.size === 0 ? <div className="empty">{open ? "No open reports. 🎉" : "No reports yet."}</div> : (
        <div className="list">
          {[...groups.values()].map((rs) => {
            const r = rs[0];
            const path = denPath(r);
            return (
              <div key={r.id} className="report">
                <div className="report-top">
                  <span className="pill">{KIND[r.target_type] || r.target_type}</span>
                  {rs.length > 1 && <span className="pill bad">{rs.length} reports</span>}
                  {r.status !== "open" && <span className="pill ok">{r.status === "actioned" ? "Removed" : "Dismissed"}</span>}
                  <span className="muted">{ago(r.created_at)}</span>
                </div>
                <blockquote>{r.gone ? <span className="muted">Already deleted.</span> : r.preview || <span className="muted">No text</span>}</blockquote>
                <p className="muted">By <b>{r.author_name || "unknown"}</b>{path && <> · <a href={denUrl + path} target="_blank" rel="noopener noreferrer">View in Den ↗</a></>}</p>
                <div className="reasons">{rs.map((x) => <p key={x.id}>&ldquo;{x.reason}&rdquo; <span className="muted">· {x.reporter_name || "a student"}</span></p>)}</div>
                {r.status === "open" && (
                  <div className="actions">
                    {r.target_type !== "user" && !r.gone && <button className="btn bad" disabled={busy === r.id} onClick={() => resolve(r, true)}>Delete it</button>}
                    <button className="btn" disabled={busy === r.id} onClick={() => resolve(r, false)}>Dismiss</button>
                    {r.author_id && <button className="link danger" disabled={busy === r.id} onClick={() => ban(r)}>Ban {r.author_name}</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
