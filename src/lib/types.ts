export type Year = "1st year" | "2nd year" | "3rd year" | "4th year" | "5th year" | "Postgrad" | "Alumni";

export interface College { id: string; name: string; city: string; state?: string; students?: number }

export interface Profile {
  id: string;
  name: string;
  college_id: string;
  branch: string;
  year: Year;
  bio: string;
  verified: boolean;
  is_admin: boolean;
  /** null = hasn't agreed yet; undefined = column not added yet (treated as agreed) */
  terms_accepted_at?: string | null;
  verified_via?: "email" | "college_email" | "id_card" | "classmates" | "admin" | null;
  verified_at?: string | null;
  banned_at?: string | null;
}

/** full = verified; grace = existing account, can post until a date; read = must verify; banned = suspended. */
export interface Access { level: "full" | "grace" | "read" | "banned"; grace_until?: string | null }

export type Author = Pick<Profile, "id" | "name" | "branch" | "year" | "verified" | "college_id">;

export interface BaseItem { id: string; author_id: string; college_id: string; created_at: string; author?: Author | null }
import type { Media } from "./media";
export interface Post extends BaseItem { visibility: "college" | "india"; kind: string; body: string; comments?: { count: number }[]; media?: Media[] }
export interface Note extends BaseItem { title: string; subject: string; kind: string; semester: number; branch: string; link: string; media?: Media[] }
export interface Placement extends BaseItem { company: string; role: string; ctc: string; result: string; rounds: string; tips: string }
export interface Listing extends BaseItem { item: string; price: number; condition: string; contact: string; details: string; sold: boolean; media?: Media[] }
export interface CampusEvent extends BaseItem {
  title: string; kind: string; event_date: string; venue: string; link: string; details: string;
  start_time?: string | null; end_time?: string | null; capacity?: number | null; tickets?: boolean;
  cancelled_at?: string | null; updated_at?: string | null; media?: Media[];
}
export type RsvpStatus = "going" | "interested";
export interface EventRsvp { event_id: string; user_id: string; status: RsvpStatus; created_at: string; profile?: Author | null }
export interface EventUpdate { id: string; event_id: string; author_id: string; body: string; created_at: string; author?: Author | null }
export interface Attendee {
  user_id: string; name: string; branch: string; year: string; college_id: string; verified: boolean;
  status: RsvpStatus; checked_in_at: string | null; created_at: string;
}
export type AnyItem = Post | Note | Placement | Listing | CampusEvent;

export interface Comment {
  id: string; post_id: string; author_id: string; body: string; created_at: string; author?: Author | null;
  /** Replies: the comment this answers (always a top-level comment) and who it answers. */
  parent_id?: string | null; reply_to?: string | null; replied?: { id: string; name: string } | null;
}

export interface Space {
  id: string;
  host_id: string;
  college_id: string;
  title: string;
  description: string;
  visibility: "college" | "india";
  mode: "space" | "debate";
  status: "scheduled" | "live" | "ended";
  scheduled_for: string | null;
  started_at: string | null;
  ended_at: string | null;
  side_a: string;
  side_b: string;
  round_index: number;
  round_ends_at: string | null;
  rounds_total: number;
  created_at: string;
  host?: Author | null;
}

export interface SpaceParticipant {
  space_id: string;
  user_id: string;
  role: "host" | "speaker" | "listener";
  side: "a" | "b" | null;
  hand_raised: boolean;
  removed: boolean;
  joined_at: string;
  profile?: Author | null;
}

export interface Conversation {
  id: string;
  is_group: boolean;
  title: string;
  last_message_at: string;
  last_message_preview: string;
  last_sender_id: string | null;
}

export interface Message { id: string; conversation_id: string; sender_id: string; body: string; created_at: string; attachments?: Media[] }

export const ARTICLE_TOPICS = ["Campus life", "Careers", "Tech", "Exams & study", "Opinion", "Stories", "Clubs", "Other"] as const;
export interface Article {
  id: string; author_id: string; college_id: string;
  visibility: "college" | "india"; topic: string;
  title: string; subtitle: string; body: string;
  status: "draft" | "published"; published_at: string | null; created_at: string; updated_at: string;
  cover?: Media[]; media?: Media[];
  author?: Author | null;
}
export interface ArticleComment { id: string; article_id: string; author_id: string; body: string; created_at: string; author?: Author | null }
