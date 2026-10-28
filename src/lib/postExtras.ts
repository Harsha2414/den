import type { SupabaseClient } from "@supabase/supabase-js";
import { groupLikes, type Likes } from "./reactions";

/** A poll on a post: the options, how many votes each has, and which one you picked. */
export type Poll = { options: string[]; counts: number[]; total: number; mine: number | null; closes_at: string | null };

export type Extras = { likes: Record<string, Likes>; saved: string[]; polls: Record<string, Poll> };

/**
 * Everything around a page of posts: reactions, which ones you saved, and polls.
 * Each part quietly comes back empty if its database migration hasn't been run yet.
 */
export async function loadExtras(supabase: SupabaseClient, ids: string[], me: string): Promise<Extras> {
  if (!ids.length) return { likes: {}, saved: [], polls: {} };
  const [lk, sv, pl, res, mine] = await Promise.all([
    supabase.from("likes").select("item_id,user_id,reaction").eq("item_type", "post").in("item_id", ids),
    supabase.from("saved_posts").select("post_id").in("post_id", ids),
    supabase.from("polls").select("post_id,options,closes_at").in("post_id", ids),
    supabase.rpc("poll_results", { p_posts: ids }),
    supabase.from("poll_votes").select("post_id,choice").in("post_id", ids),
  ]);
  let likeRows: { item_id: string; user_id: string; reaction?: string }[] | null = lk.data;
  if (lk.error) likeRows = (await supabase.from("likes").select("item_id,user_id").eq("item_type", "post").in("item_id", ids)).data;
  const polls: Record<string, Poll> = {};
  for (const p of (pl.data || []) as { post_id: string; options: string[]; closes_at: string | null }[]) {
    polls[p.post_id] = { options: p.options, counts: p.options.map(() => 0), total: 0, mine: null, closes_at: p.closes_at };
  }
  for (const r of (res.data || []) as { post_id: string; choice: number; votes: number }[]) {
    const p = polls[r.post_id]; if (!p || r.choice >= p.counts.length) continue;
    p.counts[r.choice] = r.votes; p.total += r.votes;
  }
  for (const v of (mine.data || []) as { post_id: string; choice: number }[]) if (polls[v.post_id]) polls[v.post_id].mine = v.choice;
  return {
    likes: groupLikes((likeRows || []) as { item_id: string; user_id: string; reaction?: string }[], me),
    saved: ((sv.data || []) as { post_id: string }[]).map((x) => x.post_id),
    polls,
  };
}

/** The poll after voting for `choice` (or taking the vote back when it's the same one). */
export function nextPoll(p: Poll, choice: number): { next: Poll; op: "insert" | "update" | "delete" } {
  const counts = [...p.counts];
  if (p.mine === choice) { counts[choice]--; return { next: { ...p, counts, total: p.total - 1, mine: null }, op: "delete" }; }
  if (p.mine !== null) { counts[p.mine]--; counts[choice]++; return { next: { ...p, counts, mine: choice }, op: "update" }; }
  counts[choice]++;
  return { next: { ...p, counts, total: p.total + 1, mine: choice }, op: "insert" };
}

/** The muted people and hidden posts of the signed-in student (empty before migration 0013). */
export async function loadFilters(supabase: SupabaseClient): Promise<{ hidden: string[]; muted: string[] }> {
  const [h, m] = await Promise.all([
    supabase.from("hidden_posts").select("post_id").order("created_at", { ascending: false }).limit(300),
    supabase.from("muted_users").select("muted_id").limit(300),
  ]);
  return { hidden: ((h.data || []) as { post_id: string }[]).map((x) => x.post_id), muted: ((m.data || []) as { muted_id: string }[]).map((x) => x.muted_id) };
}
