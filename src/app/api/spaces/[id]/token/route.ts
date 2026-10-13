import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { liveKitConfigured, liveKitUrl, makeToken } from "@/lib/livekit";
import type { Space, SpaceParticipant } from "@/lib/types";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in to join Spaces." }, { status: 401 });
  if (!liveKitConfigured()) return NextResponse.json({ error: "Voice isn't set up yet. Add the LiveKit keys to the app settings." }, { status: 503 });

  // Read the space as the student, so visibility rules apply.
  const { data: space } = await supabase.from("spaces").select("*").eq("id", id).maybeSingle<Space>();
  if (!space) return NextResponse.json({ error: "This Space doesn't exist or isn't open to your college." }, { status: 404 });
  if (space.status !== "live") return NextResponse.json({ error: space.status === "ended" ? "This Space has ended." : "This Space hasn't started yet." }, { status: 409 });

  const admin = supabaseAdmin();
  let { data: me } = await admin.from("space_participants").select("*").match({ space_id: id, user_id: user.id }).maybeSingle<SpaceParticipant>();
  if (!me) {
    const { error } = await supabase.from("space_participants").insert({ space_id: id, user_id: user.id });
    if (error) return NextResponse.json({ error: "Couldn't join this Space." }, { status: 403 });
    me = { space_id: id, user_id: user.id, role: "listener", side: null, hand_raised: false, removed: false, joined_at: new Date().toISOString() };
  }
  if (me.removed) return NextResponse.json({ error: "The host removed you from this Space." }, { status: 403 });
  const { data: profile } = await admin.from("profiles").select("name").eq("id", user.id).maybeSingle<{ name: string }>();
  const token = await makeToken(space, me, profile?.name || "Student");
  return NextResponse.json({ token, url: liveKitUrl() });
}
