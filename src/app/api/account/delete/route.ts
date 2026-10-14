import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { closeRoom } from "@/lib/livekit";

/**
 * Permanently deletes the signed-in student's account. Deleting the auth user cascades
 * through the database: profile, posts, comments, likes, notes, placements, listings,
 * events, messages, chat memberships, Spaces, votes, blocks, reports and AI usage.
 */
export async function POST(req: Request) {
  const { user } = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let confirm = "";
  try { confirm = String((await req.json()).confirm || ""); } catch { /* empty body */ }
  if (confirm.trim().toUpperCase() !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // End any live Spaces this student is hosting, so listeners aren't left in a dead room.
  const { data: live } = await admin.from("spaces").select("id").eq("host_id", user.id).eq("status", "live");
  await Promise.all((live || []).map((s: { id: string }) => closeRoom(s.id)));

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: "Couldn't delete your account. Try again, or contact us." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
