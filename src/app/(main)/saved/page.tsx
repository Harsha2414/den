"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGate } from "@/components/Gate";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AUTHOR_COLS, friendlyError } from "@/lib/format";
import { groupLikes, nextLikes, NO_LIKES, type Likes } from "@/lib/reactions";
import type { Post } from "@/lib/types";
import { useApp } from "@/components/AppContext";
import { useToast } from "@/components/Toast";
import ItemCard from "@/components/ItemCard";
import ReportSheet from "@/components/ReportSheet";

/** Posts the student saved to read later. Only they can see this list. */
export default function SavedPage() {
  const { me } = useApp();
  const gate = useGate();
  const toast = useToast();
  const qc = useQueryClient();
  const supabase = supabaseBrowser();
  const [likeOver, setLikeOver] = useState<Record<string, Likes>>({});
  const [unsaved, setUnsaved] = useState<Set<string>>(new Set());
  const [reporting, setReporting] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["saved", me.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("saved_posts")
        .select(`created_at, post:posts(*, author:profiles!posts_author_id_fkey(${AUTHOR_COLS}), comments(count))`)
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw new Error(friendlyError(error, "Couldn't load your saved posts."));
      // A post that was deleted, or that you can no longer see, drops out.
      const posts = ((data || []) as unknown as { post: Post | null }[]).map((r) => r.post).filter(Boolean) as Post[];
      const ids = posts.map((p) => p.id);
      let likes: Record<string, Likes> = {};
      if (ids.length) {
        const { data: ls } = await supabase.from("likes").select("item_id,user_id,reaction").eq("item_type", "post").in("item_id", ids);
        likes = groupLikes((ls || []) as { item_id: string; user_id: string; reaction?: string }[], me.id);
      }
      return { posts, likes };
    },
  });
  const posts = useMemo(() => (q.data?.posts || []).filter((p) => !unsaved.has(p.id)), [q.data, unsaved]);
  const likeOf = (id: string) => likeOver[id] || q.data?.likes[id] || NO_LIKES;

  async function react(p: Post, reaction?: string) {
    if (!gate("like posts")) return;
    const cur = likeOf(p.id);
    const { next, op, reaction: r } = nextLikes(cur, reaction);
    setLikeOver((m) => ({ ...m, [p.id]: next }));
    const match = { user_id: me.id, item_type: "post", item_id: p.id };
    const res = op === "delete" ? await supabase.from("likes").delete().match(match)
      : op === "update" ? await supabase.from("likes").update({ reaction: r }).match(match)
      : await supabase.from("likes").insert(r === "heart" ? { item_type: "post", item_id: p.id } : { item_type: "post", item_id: p.id, reaction: r });
    if (res.error) { setLikeOver((m) => ({ ...m, [p.id]: cur })); toast(friendlyError(res.error)); }
  }

  async function unsave(p: Post) {
    setUnsaved((s) => new Set(s).add(p.id));
    const { error } = await supabase.from("saved_posts").delete().match({ user_id: me.id, post_id: p.id });
    if (error) { setUnsaved((s) => { const n = new Set(s); n.delete(p.id); return n; }); return toast(friendlyError(error)); }
    toast("Removed from Saved");
    qc.invalidateQueries({ queryKey: ["scope"] });
  }

  async function remove(p: Post) {
    const { error } = await supabase.from("posts").delete().eq("id", p.id);
    if (error) return toast(friendlyError(error, "Couldn't delete that."));
    setUnsaved((s) => new Set(s).add(p.id));
    toast("Deleted");
  }

  return (
    <main className="wrap page">
      <div className="page-head">
        <h1>Saved posts</h1>
        <span>Only you can see what you&rsquo;ve saved.</span>
      </div>
      {q.error && <p className="warn">{(q.error as Error).message}</p>}
      {q.isLoading ? <div className="feed" aria-busy="true"><div className="post skel"><span className="sk sk-av" /><div style={{ flex: 1 }}><span className="sk sk-line w40" /><span className="sk sk-line" /></div></div></div>
        : posts.length === 0 ? (
          <div className="first-post">
            <b>Nothing saved yet</b>
            <p>Tap the bookmark on any post to keep it here: notes links, event details, that one helpful answer.</p>
            <Link className="secondary" href={`/c/${me.college_id}`}>Go to your college</Link>
          </div>
        ) : (
          <div className="feed">
            {posts.map((p) => (
              <ItemCard key={p.id} type="posts" item={p} showCollege={p.college_id !== me.college_id}
                likes={likeOf(p.id).n} liked={likeOf(p.id).mine} reactions={likeOf(p.id)} saved
                actions={{ onLike: () => react(p), onReact: (r) => react(p, r), onSave: () => unsave(p), onDelete: () => remove(p), onReport: () => setReporting(p.id) }} />
            ))}
          </div>
        )}
      {reporting && <ReportSheet targetType="post" targetId={reporting} onClose={() => setReporting(null)} />}
    </main>
  );
}
