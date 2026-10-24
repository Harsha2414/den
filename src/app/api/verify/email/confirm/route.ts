import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentStudent, sha256 } from "@/lib/verifyServer";

const err = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const me = await currentStudent();
  if (!me) return err("Sign in first.", 401);
  if (me.verified) return NextResponse.json({ ok: true });
  const body = await req.json().catch(() => ({}));
  const code = String(body.code || "").replace(/\D/g, "");
  if (code.length !== 6) return err("Enter the 6-digit code.");

  const admin = supabaseAdmin();
  const { data } = await admin.from("email_codes").select("*").eq("user_id", me.id).maybeSingle();
  const row = data as { email: string; code_hash: string; expires_at: string; attempts: number } | null;
  if (!row) return err("Ask for a code first.");
  if (new Date(row.expires_at).getTime() < Date.now()) return err("That code has expired. Ask for a new one.");
  if (row.attempts >= 5) return err("Too many wrong tries. Ask for a new code.", 429);
  if (sha256(`${me.id}:${code}`) !== row.code_hash) {
    await admin.from("email_codes").update({ attempts: row.attempts + 1 }).eq("user_id", me.id);
    return err(`That code isn't right. ${Math.max(0, 4 - row.attempts)} tries left.`);
  }

  const { error: claimErr } = await admin.from("verified_college_emails").insert({ email: row.email, user_id: me.id, college_id: me.college_id });
  if (claimErr) return err(/duplicate/i.test(claimErr.message) ? "This college email has already verified another Den account." : "Couldn't verify. Try again.");
  const { error: upErr } = await admin.from("profiles").update({ verified_via: "college_email" }).eq("id", me.id);
  if (upErr) return err("Couldn't verify. Try again.", 500);
  await admin.from("email_codes").delete().eq("user_id", me.id);
  return NextResponse.json({ ok: true });
}
