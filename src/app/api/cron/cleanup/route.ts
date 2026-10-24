import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Runs once a day (see vercel.json): deletes ID card photos that are reviewed or older than 7 days,
// and old unanswered classmate requests.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const admin = supabaseAdmin();
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const { data } = await admin.from("id_checks").select("id,photo_path,status,created_at").not("photo_path", "is", null)
    .or(`status.neq.pending,created_at.lt.${weekAgo}`).limit(500);
  const rows = (data || []) as { id: string; photo_path: string }[];
  if (rows.length) {
    await admin.storage.from("id-cards").remove(rows.map((r) => r.photo_path));
    await admin.from("id_checks").update({ photo_path: null, photo_deleted_at: new Date().toISOString() }).in("id", rows.map((r) => r.id));
  }
  await admin.from("vouches").delete().eq("status", "pending").lt("created_at", weekAgo);
  return NextResponse.json({ photos_deleted: rows.length });
}
