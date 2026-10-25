"use client";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { LEGAL } from "@/lib/legal";
import Icon from "./Icon";
import { clearRememberChoice } from "@/lib/remember";

export default function Suspended() {
  const router = useRouter();
  async function signOut() {
    await supabaseBrowser().auth.signOut(); clearRememberChoice();
    router.replace("/login"); router.refresh();
  }
  return (
    <main className="wrap page" style={{ display: "grid", placeItems: "center", minHeight: "80vh", textAlign: "center" }}>
      <div style={{ maxWidth: 420 }}>
        <div className="lock-badge"><Icon name="flag" size={30} /></div>
        <h1 className="title" style={{ fontSize: 26 }}>Your account is suspended</h1>
        <p className="meta" style={{ fontSize: 15 }}>
          A Den moderator suspended this account for breaking the community guidelines or for not being a real student.
          If you think this is a mistake, email <a href={`mailto:${LEGAL.grievanceEmail}`}>{LEGAL.grievanceEmail}</a> from the address you sign in with.
        </p>
        <button className="secondary" style={{ marginTop: 12 }} onClick={signOut}><Icon name="logout" size={15} /> Sign out</button>
      </div>
    </main>
  );
}
