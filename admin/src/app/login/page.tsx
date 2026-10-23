"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";

export default function LoginPage() {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function google() {
    setBusy(true); setErr("");
    const { error } = await supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
    if (error) { setErr("Couldn't start Google sign-in. Try again."); setBusy(false); }
  }
  return (
    <main className="login">
      <div className="login-card">
        <div className="brand">Den<span>.</span> <em>Admin</em></div>
        <p>For Den moderators only. Sign in with the Google account that is marked as an admin.</p>
        {err && <p className="err">{err}</p>}
        <button className="btn primary" onClick={google} disabled={busy}>{busy ? "Opening Google..." : "Sign in with Google"}</button>
      </div>
    </main>
  );
}
