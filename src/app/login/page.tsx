"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import Link from "next/link";
import { friendlyError, looksAcademic, safeNext } from "@/lib/format";
import Icon from "@/components/Icon";
import PolicyLinks from "@/components/PolicyLinks";

// Set NEXT_PUBLIC_EMAIL_CODES=off in Vercel (then redeploy) to hide email-code sign-in until an email sender works.
const EMAIL_CODES_ON = process.env.NEXT_PUBLIC_EMAIL_CODES !== "off";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [deletedNotice, setDeletedNotice] = useState(false);
  const [next, setNext] = useState("/");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setDeletedNotice(q.get("deleted") === "1");
    setNext(safeNext(q.get("next")));
  }, []);

  async function google() {
    const supabase = supabaseBrowser();
    setErr("");
    // Remember the page they came for; the sign-in callback reads this and sends them there.
    document.cookie = `den_next=${encodeURIComponent(next)}; path=/; max-age=600; samesite=lax`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setErr(friendlyError(error, "Couldn't start Google sign-in. Try again."));
  }

  async function sendCode(e: React.FormEvent) {
    const supabase = supabaseBrowser();
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) return setErr("Enter a valid email address.");
    setBusy(true); setErr("");
    let allowed = looksAcademic(addr);
    if (!allowed) {
      const { data } = await supabase.rpc("check_signup_email", { p_email: addr });
      allowed = data === true;
    }
    if (!allowed) {
      setBusy(false);
      return setErr("Email codes work only with college emails (like name@college.ac.in). Use Google sign-in instead, or ask us to add your college's email domain.");
    }
    const { error } = await supabase.auth.signInWithOtp({ email: addr, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) {
      console.error("Sign-in code error:", error.message);
      if (/rate limit/i.test(error.message)) return setErr("Too many codes requested. Wait a few minutes and try again.");
      if (/sending|smtp|email/i.test(error.message)) return setErr("We couldn't send your sign-in code right now. Try again in a few minutes, or use Continue with Google.");
      return setErr(friendlyError(error, "Couldn't send the code. Try again, or use Continue with Google."));
    }
    setEmail(addr); setStage("code");
  }

  async function verify(e: React.FormEvent) {
    const supabase = supabaseBrowser();
    e.preventDefault();
    const token = code.replace(/\s/g, "");
    if (!/^\d{6,8}$/.test(token)) return setErr("Enter the code from the email.");
    setBusy(true); setErr("");
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    setBusy(false);
    if (error) return setErr("That code is wrong or expired. Check the email or send a new code.");
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="auth">
      <aside className="auth-side" aria-hidden="true">
        <Link href="/" className="auth-logo" tabIndex={-1}>Den<span>.</span></Link>
        <div>
          <p className="auth-side-big">The student hangout for every college in India.</p>
          <ul>
            <li><Icon name="book" size={18} /> Notes, PYQs and placement stories from your seniors</li>
            <li><Icon name="ticket" size={18} /> Events with one-tap RSVP and QR passes</li>
            <li><Icon name="mic" size={18} /> Live voice Spaces and debates</li>
            <li><Icon name="shield" size={18} /> Verified students only</li>
          </ul>
        </div>
        <small>Free for every student.</small>
      </aside>

      <main className="auth-main">
        <Link href="/" className="auth-back"><Icon name="back" size={18} /> <b>Den<span>.</span></b></Link>
        <div className="auth-card">
          <h1>{stage === "email" ? "Join Den" : "Check your email"}</h1>
          <p className="auth-sub">{stage === "email"
            ? "New here or coming back, it's the same button. We'll set up your account the first time."
            : <>We sent a sign-in code to <b>{email}</b>. It can take a minute to arrive, so check spam too.</>}</p>

          <div className="form">
            {deletedNotice && <p className="notice">Your account has been deleted. Thanks for being part of Den.</p>}
            {err && <p className="err" role="alert">{err}</p>}
            {stage === "email" ? (
              <>
                <button className="btn-google" onClick={google} type="button">
                  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
                  Continue with Google
                </button>
                {EMAIL_CODES_ON && <>
                <div className="divider">or use your college email</div>
                <form className="form" onSubmit={sendCode}>
                  <div className="field">
                    <label htmlFor="email">College email</label>
                    <input id="email" type="email" autoComplete="email" inputMode="email" placeholder="you@college.ac.in" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <small><Icon name="check" size={13} /> College email gets you the blue tick straight away.</small>
                  </div>
                  <button className="primary" disabled={busy}>{busy ? "Sending code..." : "Send sign-in code"}</button>
                </form>
                </>}
              </>
            ) : (
              <form className="form" onSubmit={verify}>
                <div className="field">
                  <label htmlFor="code">Sign-in code</label>
                  <input id="code" className="code-input" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
                </div>
                <button className="primary" disabled={busy}>{busy ? "Checking..." : "Sign in"}</button>
                <button type="button" className="ghost auth-alt" onClick={() => { setStage("email"); setCode(""); setErr(""); }}>Use a different email</button>
              </form>
            )}
          </div>
          <p className="auth-fine">Den is for students aged 18 and over. By continuing, you agree to our <Link href="/terms">terms</Link> and <Link href="/privacy">privacy policy</Link>.</p>
        </div>
        <PolicyLinks />
      </main>
    </div>
  );
}
