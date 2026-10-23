"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppContext";
import { useToast } from "@/components/Toast";
import Icon from "@/components/Icon";

export default function VerifyEmailPage() {
  const { collegeName, me } = useApp();
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function post(url: string, body: object) {
    setBusy(true); setErr("");
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : { error: "Couldn't reach the server. Check your connection." };
    setBusy(false);
    if (!res || !res.ok) { setErr(j.error || "Something went wrong. Try again."); return false; }
    return true;
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (await post("/api/verify/email/start", { email })) { setStep("code"); setCode(""); toast("Code sent"); }
  }
  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (await post("/api/verify/email/confirm", { code })) { toast("You're verified"); router.replace("/verify"); router.refresh(); }
  }

  return (
    <main className="wrap page">
      <div className="row" style={{ marginTop: 12 }}><Link href="/verify" className="ghost"><Icon name="back" size={16} /> Get verified</Link></div>
      {step === "email" ? (
        <form className="form" onSubmit={sendCode} style={{ marginTop: 12 }}>
          <div className="page-head" style={{ margin: 0 }}><h1>Your college email</h1><span>We&rsquo;ll send it a 6-digit code. Your login stays the same.</span></div>
          {err && <p className="err" role="alert">{err}</p>}
          <div className="field">
            <label htmlFor="cemail">College email</label>
            <input id="cemail" type="email" inputMode="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@college.ac.in" required />
            <small>It must be from {collegeName(me.college_id) || "your college"}. One college email can verify one Den account.</small>
          </div>
          <button className="primary" disabled={busy || !email.trim()}>{busy ? "Sending..." : "Send code"}</button>
        </form>
      ) : (
        <form className="form" onSubmit={confirm} style={{ marginTop: 12 }}>
          <div className="page-head" style={{ margin: 0 }}><h1>Enter the code</h1><span>Sent to <b style={{ color: "var(--ink)" }}>{email}</b>. Check spam if you don&rsquo;t see it.</span></div>
          {err && <p className="err" role="alert">{err}</p>}
          <input className="otp" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" aria-label="6-digit code" />
          <button className="primary" disabled={busy || code.length !== 6}>{busy ? "Checking..." : "Verify"}</button>
          <div className="row" style={{ justifyContent: "center" }}>
            <button type="button" className="ghost" disabled={busy} onClick={() => sendCode()}>Resend code</button>
            <button type="button" className="ghost" onClick={() => { setStep("email"); setErr(""); }}>Change email</button>
          </div>
        </form>
      )}
    </main>
  );
}
