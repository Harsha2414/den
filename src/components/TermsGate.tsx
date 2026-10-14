"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/format";
import PolicyLinks from "./PolicyLinks";

/** One-time screen for accounts created before the terms existed. */
export default function TermsGate({ userId }: { userId: string }) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function accept() {
    if (!agreed) return setErr("Tick the box to continue.");
    setBusy(true); setErr("");
    const { error } = await supabaseBrowser().from("profiles")
      .update({ terms_accepted_at: new Date().toISOString() }).eq("id", userId);
    setBusy(false);
    if (error) return setErr(friendlyError(error, "Couldn't save. Try again."));
    router.refresh();
  }

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="onb">
      <h1>Before you continue<span>a few ground rules.</span></h1>
      <p>Den now has terms of use, a privacy policy and community guidelines. Please read them and agree to keep using Den.</p>
      <div className="form">
        {err && <p className="err" role="alert">{err}</p>}
        <label className="agree">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>I&rsquo;m 18 or older, and I agree to Den&rsquo;s <a href="/terms" target="_blank">terms of use</a>, <a href="/privacy" target="_blank">privacy policy</a> and <a href="/guidelines" target="_blank">community guidelines</a>.</span>
        </label>
        <button className="primary" onClick={accept} disabled={busy}>{busy ? "Saving..." : "Agree and continue"}</button>
        <button className="ghost" onClick={signOut}>Sign out instead</button>
      </div>
      <PolicyLinks />
    </main>
  );
}
