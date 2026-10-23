"use client";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase";

export default function NotAdmin({ email }: { email: string }) {
  const router = useRouter();
  async function out() { await supabaseBrowser().auth.signOut(); router.replace("/login"); router.refresh(); }
  return (
    <main className="login">
      <div className="login-card">
        <div className="brand">Den<span>.</span> <em>Admin</em></div>
        <p><b>{email || "This account"}</b> isn&rsquo;t a Den admin, so this page is closed.</p>
        <button className="btn" onClick={out}>Sign out</button>
      </div>
    </main>
  );
}
