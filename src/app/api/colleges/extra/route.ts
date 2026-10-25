import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Small companion to /data/colleges-v1.json for instant college search:
// colleges whose Den id isn't "aishe-<code>", colleges students added, and how many students each college has.
// Public data only (names, places, counts). Cached for a few minutes.
export const revalidate = 300;

export async function GET() {
  const empty = { aishe: 0, remap: [], extra: [], counts: [] };
  try {
    const db = supabaseAdmin();
    const [countRes, remapRes, extraRes, activeRes] = await Promise.all([
      db.from("colleges").select("id", { count: "exact", head: true }).not("aishe_code", "is", null),
      db.from("colleges").select("id,aishe_code").not("aishe_code", "is", null).not("id", "like", "aishe-%").limit(5000),
      db.from("colleges").select("id,name,city,state").is("aishe_code", null).limit(5000),
      db.rpc("active_colleges"),
    ]);
    if (countRes.error || remapRes.error || extraRes.error) return NextResponse.json(empty);
    const body = {
      aishe: countRes.count || 0,
      remap: (remapRes.data || []).map((r) => [r.aishe_code, r.id]),
      extra: (extraRes.data || []).map((r) => [r.id, r.name, r.city || "", r.state || ""]),
      counts: ((activeRes.data || []) as { id: string; students: number }[]).map((r) => [r.id, r.students]),
    };
    return NextResponse.json(body, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
  } catch {
    return NextResponse.json(empty);
  }
}
