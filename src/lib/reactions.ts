/** Post reactions: tap the heart for a like, long-press it for the others. */
export const REACTIONS = [
  { id: "heart", emoji: "❤️", label: "Love" },
  { id: "laugh", emoji: "😂", label: "Haha" },
  { id: "wow", emoji: "😮", label: "Wow" },
  { id: "sad", emoji: "😢", label: "Sad" },
  { id: "fire", emoji: "🔥", label: "Fire" },
  { id: "clap", emoji: "👏", label: "Clap" },
] as const;
export type ReactionId = (typeof REACTIONS)[number]["id"];
export const emojiOf = (id: string | null | undefined) => REACTIONS.find((r) => r.id === id)?.emoji || "❤️";
export const labelOf = (id: string | null | undefined) => REACTIONS.find((r) => r.id === id)?.label || "Love";

/** Likes on one item: how many, mine (and which reaction), and the count of each reaction. */
export type Likes = { n: number; mine: boolean; my: string | null; counts: Record<string, number> };
export const NO_LIKES: Likes = { n: 0, mine: false, my: null, counts: {} };

/** Group like rows ({item_id, user_id, reaction}) by item. */
export function groupLikes(rows: { item_id: string; user_id: string; reaction?: string | null }[], me: string) {
  const out: Record<string, Likes> = {};
  for (const l of rows) {
    const e = (out[l.item_id] ||= { n: 0, mine: false, my: null, counts: {} });
    const r = l.reaction || "heart";
    e.n++; e.counts[r] = (e.counts[r] || 0) + 1;
    if (l.user_id === me) { e.mine = true; e.my = r; }
  }
  return out;
}

/** The new state after choosing `r` (or tapping the heart when r is undefined). */
export function nextLikes(cur: Likes, r?: string): { next: Likes; op: "insert" | "update" | "delete"; reaction: string } {
  const counts = { ...cur.counts };
  const drop = (k: string | null) => { if (k && counts[k]) { counts[k]--; if (!counts[k]) delete counts[k]; } };
  if (cur.my && (r === undefined || r === cur.my)) {
    drop(cur.my);
    return { next: { n: cur.n - 1, mine: false, my: null, counts }, op: "delete", reaction: cur.my };
  }
  const want = r || "heart";
  if (cur.my) {
    drop(cur.my); counts[want] = (counts[want] || 0) + 1;
    return { next: { ...cur, my: want, counts }, op: "update", reaction: want };
  }
  counts[want] = (counts[want] || 0) + 1;
  return { next: { n: cur.n + 1, mine: true, my: want, counts }, op: "insert", reaction: want };
}

/** The 3 most used reactions, for the little row of emoji next to the count. */
export const topReactions = (counts: Record<string, number>) =>
  Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
