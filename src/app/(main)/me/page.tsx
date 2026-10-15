"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useApp } from "@/components/AppContext";
import { useToast } from "@/components/Toast";
import ProfileForm from "@/components/ProfileForm";
import Avatar from "@/components/Avatar";
import Icon, { VerifiedTick } from "@/components/Icon";
import Sheet from "@/components/Sheet";
import PolicyLinks from "@/components/PolicyLinks";

export default function MePage() {
  const { me, colleges, collegeName } = useApp();
  const router = useRouter();
  const toast = useToast();
  const supabase = supabaseBrowser();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteErr, setDeleteErr] = useState("");
  const [blocked, setBlocked] = useState<{ blocked_id: string; profile: { name: string } | null }[]>([]);

  useEffect(() => {
    supabase.from("blocks").select("blocked_id, profile:profiles!blocks_blocked_id_fkey(name)")
      .then(({ data }: { data: unknown[] | null }) => setBlocked((data || []) as typeof blocked));
  }, [supabase]);

  async function unblock(id: string) {
    const { error } = await supabase.from("blocks").delete().eq("blocked_id", id);
    if (error) return toast("Couldn't unblock. Try again.");
    setBlocked((b) => b.filter((x) => x.blocked_id !== id));
    toast("Unblocked");
  }

  async function deleteAccount() {
    if (confirmText.trim().toUpperCase() !== "DELETE") return setDeleteErr("Type DELETE to confirm.");
    setDeleteBusy(true); setDeleteErr("");
    const res = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: confirmText }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setDeleteBusy(false); return setDeleteErr(j.error || "Couldn't delete your account. Try again."); }
    await supabase.auth.signOut().catch(() => {});
    router.replace("/login?deleted=1");
    router.refresh();
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="wrap page">
      <div className="prof">
        <Avatar id={me.id} name={me.name} size="lg" />
        <div>
          <h1>{me.name}{me.verified && <VerifiedTick />}</h1>
          <div className="meta">{me.branch}, {me.year}</div>
          <div className="meta">{collegeName(me.college_id)}</div>
        </div>
      </div>
      {me.bio && <p className="body">{me.bio}</p>}
      {!me.verified && <p className="notice">Sign in with your college email to get the verified student badge.</p>}

      <div className="row" style={{ marginBottom: 20 }}>
        <button className="secondary" onClick={() => setEditing(true)}>Edit profile</button>
        <button className="secondary danger" onClick={signOut}><Icon name="logout" size={15} /> Sign out</button>
      </div>

      <Link className="card" href="/events" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit", marginBottom: 8 }}>
        <Icon name="clock" /><div style={{ flex: 1 }}><b>My events</b><div className="meta">Tickets, events you&rsquo;re going to, and ones you organise</div></div><span aria-hidden="true">›</span>
      </Link>

      <div className="sec-head"><h2>Blocked students</h2></div>
      {blocked.length === 0 ? <p className="meta">You haven't blocked anyone. Blocked students can't message you.</p> :
        blocked.map((b) => (
          <div key={b.blocked_id} className="pick">
            <div><b>{b.profile?.name || "Student"}</b></div>
            <button className="secondary" onClick={() => unblock(b.blocked_id)}>Unblock</button>
          </div>
        ))}

      <section className="danger-zone">
        <h3>Delete my account</h3>
        <p className="meta" style={{ margin: "0 0 10px" }}>Permanently deletes your profile, posts, comments, notes, messages, Spaces and votes. This can&rsquo;t be undone.</p>
        <button className="secondary danger" onClick={() => { setDeleting(true); setConfirmText(""); setDeleteErr(""); }}>Delete my account</button>
      </section>

      <PolicyLinks />
      <p className="note" style={{ marginTop: 24 }}>App version {(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7)}</p>

      {deleting && (
        <Sheet title="Delete your account?" onClose={() => !deleteBusy && setDeleting(false)}>
          <div className="form">
            <p className="body" style={{ margin: 0 }}>
              This permanently deletes your Den account and everything you&rsquo;ve posted: your profile, posts, comments, notes,
              placement stories, listings, events, messages, Spaces and votes. Messages you sent will disappear from other people&rsquo;s chats too.
            </p>
            <p className="body" style={{ margin: 0 }}>You can sign up again later, but nothing can be recovered.</p>
            {deleteErr && <p className="err" role="alert">{deleteErr}</p>}
            <div className="field">
              <label htmlFor="del-confirm">Type <b>DELETE</b> to confirm</label>
              <input id="del-confirm" value={confirmText} autoCapitalize="characters" autoComplete="off" onChange={(e) => setConfirmText(e.target.value)} />
            </div>
            <button className="primary" style={{ background: "var(--rose)" }} onClick={deleteAccount}
              disabled={deleteBusy || confirmText.trim().toUpperCase() !== "DELETE"}>
              {deleteBusy ? "Deleting..." : "Permanently delete my account"}
            </button>
            <button className="ghost" onClick={() => setDeleting(false)} disabled={deleteBusy}>Keep my account</button>
          </div>
        </Sheet>
      )}

      {editing && (
        <Sheet title="Edit profile" onClose={() => setEditing(false)}>
          <ProfileForm userId={me.id} colleges={colleges} initial={me} onDone={() => setEditing(false)} />
        </Sheet>
      )}
    </main>
  );
}
