import type { Author, Conversation } from "./types";

export interface ConvMember { user_id: string; last_read_at: string; profile: Pick<Author, "id" | "name" | "verified"> | null }
export type ConvWithMembers = Conversation & { members: ConvMember[] };

export const CONV_SELECT = "*, members:conversation_members(user_id, last_read_at, profile:profiles!conversation_members_user_id_fkey(id,name,verified))";

export function convTitle(c: ConvWithMembers, meId: string): string {
  if (c.is_group) return c.title || "Group";
  const other = c.members.find((m) => m.user_id !== meId);
  return other?.profile?.name || "Student";
}

export function convOther(c: ConvWithMembers, meId: string) {
  return c.is_group ? null : c.members.find((m) => m.user_id !== meId) || null;
}

export function isUnread(c: ConvWithMembers, meId: string): boolean {
  const mine = c.members.find((m) => m.user_id === meId);
  return !!mine && !!c.last_sender_id && c.last_sender_id !== meId && new Date(c.last_message_at) > new Date(mine.last_read_at);
}
