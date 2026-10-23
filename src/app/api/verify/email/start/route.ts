import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentStudent, sendCodeEmail, sha256, smtpReady } from "@/lib/verifyServer";

const err = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const me = await currentStudent();
  if (!me) return err("Sign in first.", 401);
  if (me.verified) return err("You're already verified.");
  if (me.banned_at) return err("Your account is suspended.", 403);
  if (!smtpReady()) return err("College email verification isn't switched on yet. Try the ID card or classmates option.", 503);

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return err("Enter a valid email address.");
  const domain = email.split("@")[1];

  const admin = supabaseAdmin();
  const { data: academic } = await admin.rpc("is_academic_email", { p_email: email });
  if (!academic) return err("That doesn't look like a college email. It should end in .ac.in, .edu.in or .edu, or a domain your college uses.");

  // If this domain is registered to a different college, don't let it verify this one.
  const { data: owners } = await admin.from("colleges").select("id,name").contains("email_domains", [domain]);
  const other = (owners || []).find((c: { id: string }) => c.id !== me.college_id);
  if (other && !(owners || []).some((c: { id: string }) => c.id === me.college_id)) {
    return err(`That email belongs to ${(other as { name: string }).name}. Use your own college's email, or change your college in your profile.`);
  }

  const { data: used } = await admin.from("verified_college_emails").select("user_id").eq("email", email).maybeSingle();
  if (used && (used as { user_id: string }).user_id !== me.id) return err("This college email has already verified another Den account.");

  const { data: prev } = await admin.from("email_codes").select("sends,last_sent_at").eq("user_id", me.id).maybeSingle();
  const p = prev as { sends: number; last_sent_at: string } | null;
  const sameDay = p && Date.now() - new Date(p.last_sent_at).getTime() < 24 * 3600e3;
  if (p && Date.now() - new Date(p.last_sent_at).getTime() < 60e3) return err("Wait a minute before asking for another code.", 429);
  if (sameDay && p!.sends >= 5) return err("You've asked for 5 codes today. Try again tomorrow.", 429);

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const { error: saveErr } = await admin.from("email_codes").upsert({
    user_id: me.id, email, code_hash: sha256(`${me.id}:${code}`),
    expires_at: new Date(Date.now() + 10 * 60e3).toISOString(), attempts: 0,
    sends: sameDay ? p!.sends + 1 : 1, last_sent_at: new Date().toISOString(),
  });
  if (saveErr) return err("Couldn't start verification. Try again.", 500);

  try {
    await sendCodeEmail(email, code, me.name);
  } catch {
    return err("Couldn't send the email. Check the address and try again.", 502);
  }
  return NextResponse.json({ ok: true });
}
