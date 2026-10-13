export type Year = "1st year" | "2nd year" | "3rd year" | "4th year" | "5th year" | "Postgrad" | "Alumni";

export interface College { id: string; name: string; city: string }

export interface Profile {
  id: string;
  name: string;
  college_id: string;
  branch: string;
  year: Year;
  bio: string;
  verified: boolean;
  is_admin: boolean;
}

export type Author = Pick<Profile, "id" | "name" | "branch" | "year" | "verified" | "college_id">;

export interface BaseItem { id: string; author_id: string; college_id: string; created_at: string; author?: Author | null }
export interface Post extends BaseItem { visibility: "college" | "india"; kind: string; body: string; comments?: { count: number }[] }
export interface Note extends BaseItem { title: string; subject: string; kind: string; semester: number; branch: string; link: string }
export interface Placement extends BaseItem { company: string; role: string; ctc: string; result: string; rounds: string; tips: string }
export interface Listing extends BaseItem { item: string; price: number; condition: string; contact: string; details: string; sold: boolean }
export interface CampusEvent extends BaseItem { title: string; kind: string; event_date: string; venue: string; link: string; details: string }
export type AnyItem = Post | Note | Placement | Listing | CampusEvent;

export interface Comment { id: string; post_id: string; author_id: string; body: string; created_at: string; author?: Author | null }

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

export interface Message { id: string; conversation_id: string; sender_id: string; body: string; created_at: string }
