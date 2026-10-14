"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useApp } from "@/components/AppContext";
import { useToast } from "@/components/Toast";
import ProfileForm from "@/components/ProfileForm";
import Avatar from "@/components/Avatar";
import Icon, { VerifiedTick } from "@/components/Icon";
import Sheet from "@/components/Sheet";

export default function MePage() {
  const { me, colleges, collegeName } = useApp();
  const router = useRouter();
  const toast = useToast();
  const supabase = supabaseBrowser();
  const [editing, setEditing] = useState(false);
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

      <div className="sec-head"><h2>Blocked students</h2></div>
      {blocked.length === 0 ? <p className="meta">You haven't blocked anyone. Blocked students can't message you.</p> :
        blocked.map((b) => (
          <div key={b.blocked_id} className="pick">
            <div><b>{b.profile?.name || "Student"}</b></div>
            <button className="secondary" onClick={() => unblock(b.blocked_id)}>Unblock</button>
          </div>
        ))}

      <p className="note" style={{ marginTop: 24 }}>App version {(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7)}</p>

      {editing && (
        <Sheet title="Edit profile" onClose={() => setEditing(false)}>
          <ProfileForm userId={me.id} colleges={colleges} initial={me} onDone={() => setEditing(false)} />
        </Sheet>
      )}
    </main>
  );
}
