import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { closeRoom, kick, syncPermissions } from "@/lib/livekit";
import { MAX_DEBATERS_PER_SIDE, ROUNDS } from "@/lib/debate";
import type { Space, SpaceParticipant } from "@/lib/types";

type Action =
  | { action: "start" }
  | { action: "end" }
  | { action: "next_round"; auto?: boolean }
  | { action: "invite"; userId: string; side?: "a" | "b" | null }
  | { action: "demote"; userId: string }
  | { action: "remove"; userId: string }
  | { action: "lower_hand"; userId: string };

const err = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await getUser();
  if (!user) return err("Sign in first.", 401);

  let body: Action;
  try { body = (await req.json()) as Action; } catch { return err("Bad request."); }

  const admin = supabaseAdmin();
  const { data: space } = await admin.from("spaces").select("*").eq("id", id).maybeSingle<Space>();
  if (!space) return err("This Space doesn't exist.", 404);
  if (space.host_id !== user.id) return err("Only the host can do that.", 403);
  if (space.status === "ended") return err("This Space has ended.", 409);

  const now = new Date();
  const loadParticipants = async () =>
    ((await admin.from("space_participants").select("*").eq("space_id", id)).data || []) as SpaceParticipant[];

  switch (body.action) {
    case "start": {
      if (space.status === "live") break;
      const { error } = await admin.from("spaces").update({ status: "live", started_at: now.toISOString() }).eq("id", id);
      if (error) return err("Couldn't start the Space.", 500);
      return NextResponse.json({ ok: true });
    }

    case "end": {
      await admin.from("spaces").update({ status: "ended", ended_at: now.toISOString(), round_ends_at: null }).eq("id", id);
      await admin.from("space_participants").update({ hand_raised: false }).eq("space_id", id);
      await closeRoom(id);
      return NextResponse.json({ ok: true });
    }

    case "next_round": {
      if (space.mode !== "debate") return err("Rounds are only for debates.");
      if (space.status !== "live") return err("Start the debate first.");
      // The host's screen advances automatically when the clock runs out; ignore duplicate auto calls.
      if (body.auto && space.round_ends_at && new Date(space.round_ends_at).getTime() - now.getTime() > 3000) break;
      const next = Math.min(space.round_index + 1, ROUNDS.length);
      const r = ROUNDS[next];
      const update = { round_index: next, round_ends_at: r ? new Date(now.getTime() + r.seconds * 1000).toISOString() : null };
      const { error } = await admin.from("spaces").update(update).eq("id", id);
      if (error) return err("Couldn't move to the next round.", 500);
      await syncPermissions({ ...space, ...update }, await loadParticipants());
      return NextResponse.json({ ok: true });
    }

    case "invite": {
      if (body.userId === user.id) return err("You're already the host.");
      const side = space.mode === "debate" ? body.side ?? null : null;
      if (side) {
        const ps = await loadParticipants();
        const count = ps.filter((p) => p.role === "speaker" && p.side === side && p.user_id !== body.userId).length;
        if (count >= MAX_DEBATERS_PER_SIDE) return err(`Each side can have up to ${MAX_DEBATERS_PER_SIDE} debaters.`);
      }
      const { error } = await admin.from("space_participants")
        .update({ role: "speaker", side, hand_raised: false }).match({ space_id: id, user_id: body.userId });
      if (error) return err("Couldn't invite them.", 500);
      break;
    }

    case "demote": {
      if (body.userId === user.id) return err("The host can't become a listener.");
      await admin.from("space_participants").update({ role: "listener", side: null, hand_raised: false }).match({ space_id: id, user_id: body.userId });
      break;
    }

    case "lower_hand": {
      await admin.from("space_participants").update({ hand_raised: false }).match({ space_id: id, user_id: body.userId });
      return NextResponse.json({ ok: true });
    }

    case "remove": {
      if (body.userId === user.id) return err("The host can't remove themselves. End the Space instead.");
      await admin.from("space_participants").update({ role: "listener", side: null, hand_raised: false, removed: true }).match({ space_id: id, user_id: body.userId });
      await kick(id, body.userId);
      return NextResponse.json({ ok: true });
    }

    default:
      return err("Unknown action.");
  }

  if (space.status === "live") await syncPermissions(space, await loadParticipants());
  return NextResponse.json({ ok: true });
}
