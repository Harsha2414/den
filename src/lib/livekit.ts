import "server-only";
import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { canSpeak } from "./debate";
import type { Space, SpaceParticipant } from "./types";

const url = () => process.env.NEXT_PUBLIC_LIVEKIT_URL || "";
const httpUrl = () => url().replace(/^wss:/, "https:").replace(/^ws:/, "http:");

export function liveKitConfigured() {
  return !!(url() && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET);
}

export function roomService() {
  return new RoomServiceClient(httpUrl(), process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!);
}

/** Microphone-only permissions; nobody can publish camera, screen or data. */
function permission(publish: boolean) {
  return {
    canSubscribe: true,
    canPublish: publish,
    canPublishData: false,
    canPublishSources: publish ? [TrackSource.MICROPHONE] : [],
    canUpdateMetadata: false,
  };
}

export async function makeToken(space: Space, p: SpaceParticipant, name: string) {
  const at = new AccessToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!, {
    identity: p.user_id,
    name,
    ttl: "4h",
  });
  at.addGrant({ room: space.id, roomJoin: true, ...permission(canSpeak(space, p)) });
  return at.toJwt();
}

/** Apply who-can-speak to everyone currently connected to the room. */
export async function syncPermissions(space: Space, participants: SpaceParticipant[]) {
  const svc = roomService();
  let live;
  try { live = await svc.listParticipants(space.id); } catch { return; } // room not created yet
  const byId = new Map(participants.map((p) => [p.user_id, p]));
  await Promise.all(live.map(async (lp) => {
    const allowed = canSpeak(space, byId.get(lp.identity));
    const has = !!lp.permission?.canPublish;
    if (allowed === has) return;
    try { await svc.updateParticipant(space.id, lp.identity, { permission: permission(allowed) }); } catch { /* left meanwhile */ }
  }));
}

export async function kick(spaceId: string, identity: string) {
  try { await roomService().removeParticipant(spaceId, identity); } catch { /* not connected */ }
}

export async function closeRoom(spaceId: string) {
  try { await roomService().deleteRoom(spaceId); } catch { /* already gone */ }
}

export const liveKitUrl = url;
