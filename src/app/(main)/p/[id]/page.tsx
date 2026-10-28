"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGate } from "@/components/Gate";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AUTHOR_COLS, friendlyError } from "@/lib/format";
import type { Post } from "@/lib/types";
import { useApp } from "@/components/AppContext";
import { useToast } from "@/components/Toast";
import ItemCard from "@/components/ItemCard";
import ReportSheet from "@/components/ReportSheet";
import Icon from "@/components/Icon";
import { nextLikes, NO_LIKES, type Likes } from "@/lib/reactions";
import { loadExtras, nextPoll, type Poll } from "@/lib/postExtras";

/** One post on its own page: where a shared post link opens. */
export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me, college, ensureCollege } = useApp();
  const gate = useGate();
  const toast = useToast();
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [post, setPost] = useState<Post | null | undefined>(undefined);
  const [likes, setLikes] = useState<Likes>(NO_LIKES);
  const [saved, setSaved] = useState(false);
  const [poll, setPoll] = useState<Poll | undefined>(undefined);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const { data } = await supabase.from("posts").select(`*, author:profiles!posts_author_id_fkey(${AUTHOR_COLS}), comments(count)`).eq("id", id).maybeSingle();
      if (!live) return;
      setPost((data as Post | null) || null);
      if (data) {
        ensureCollege((data as Post).college_id);
        const ex = await loadExtras(supabase, [id], me.id);
        if (live) { setLikes(ex.likes[id] || NO_LIKES); setSaved(ex.saved.includes(id)); setPoll(ex.polls[id]); }
      }
    })();
    return () => { live = false; };
  }, [id, me.id, supabase, ensureCollege]);

  async function react(reaction?: string) {
    if (!gate("like posts")) return;
    const cur = likes;
    const { next, op, reaction: r } = nextLikes(cur, reaction);
    setLikes(next);
    const match = { user_id: me.id, item_type: "post", item_id: id };
    const res = op === "delete" ? await supabase.from("likes").delete().match(match)
      : op === "update" ? await supabase.from("likes").update({ reaction: r }).match(match)
      : await supabase.from("likes").insert(r === "heart" ? { item_type: "post", item_id: id } : { item_type: "post", item_id: id, reaction: r });
    if (res.error) { setLikes(cur); toast(friendlyError(res.error)); }
  }

  async function vote(choice: number) {
    if (!gate("vote in polls") || !poll) return;
    const cur = poll; const { next, op } = nextPoll(cur, choice);
    setPoll(next);
    const match = { post_id: id, user_id: me.id };
    const res = op === "delete" ? await supabase.from("poll_votes").delete().match(match)
      : op === "update" ? await supabase.from("poll_votes").update({ choice }).match(match)
      : await supabase.from("poll_votes").insert({ post_id: id, choice });
    if (res.error) { setPoll(cur); toast(friendlyError(res.error, "Couldn't save your vote.")); }
  }

  async function hideOrMute(kind: "hide" | "mute") {
    if (!post) return;
    const { error } = kind === "hide" ? await supabase.from("hidden_posts").insert({ post_id: id }) : await supabase.from("muted_users").insert({ muted_id: post.author_id });
    if (error && !/duplicate/i.test(error.message)) return toast(friendlyError(error));
    toast(kind === "hide" ? "Post hidden" : `Muted ${post.author?.name || "them"}`);
    router.replace(home);
  }

  async function pin(on: boolean) {
    const { error } = await supabase.rpc("admin_pin_post", { p_post: id, p_pin: on });
    if (error) return toast(friendlyError(error, "Couldn't pin that."));
    setPost((p) => (p ? { ...p, pinned_at: on ? new Date().toISOString() : null } : p));
    toast(on ? "Pinned to the top" : "Unpinned");
  }

  async function toggleSave() {
    const was = saved;
    setSaved(!was);
    const res = was ? await supabase.from("saved_posts").delete().match({ user_id: me.id, post_id: id }) : await supabase.from("saved_posts").insert({ post_id: id });
    if (res.error) { setSaved(was); return toast(friendlyError(res.error, "Couldn't save that. Try again.")); }
    toast(was ? "Removed from Saved" : "Saved. Find it in the menu under Saved posts.");
  }

  async function remove() {
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) return toast(friendlyError(error, "Couldn't delete that."));
    toast("Deleted");
    router.replace(`/c/${me.college_id}`);
  }

  const home = post ? (post.visibility === "india" && post.college_id !== me.college_id ? "/india" : `/c/${post.college_id}`) : `/c/${me.college_id}`;
  const where = post ? (home === "/india" ? "All India" : college(post.college_id)?.name || "the college") : "";

  return (
    <main className="wrap page post-page">
      <Link href={home} className="back-link"><Icon name="back" size={18} /> {post ? `Back to ${where}` : "Back"}</Link>
      {post === undefined && <div className="feed" aria-busy="true"><div className="post skel"><span className="sk sk-av" /><div style={{ flex: 1 }}><span className="sk sk-line w40" /><span className="sk sk-line" /><span className="sk sk-line w70" /></div></div></div>}
      {post === null && (
        <div className="empty">
          <b>This post isn&rsquo;t available</b>
          It may have been deleted, or it&rsquo;s only for students of its own college.
          <Link className="secondary" href={`/c/${me.college_id}`}>Go to your college</Link>
        </div>
      )}
      {post && (
        <div className="feed">
          <ItemCard type="posts" item={post} likes={likes.n} liked={likes.mine} reactions={likes} saved={saved} poll={poll} full showCollege={post.college_id !== me.college_id} openComments
            actions={{
              onLike: () => react(), onReact: react, onSave: toggleSave, onDelete: remove, onReport: () => setReporting(true), onVote: vote,
              onHide: () => hideOrMute("hide"), onMute: () => hideOrMute("mute"), onPin: pin,
              onEdited: (b) => setPost((p) => (p ? { ...p, body: b, edited_at: new Date().toISOString() } : p)),
            }} />
        </div>
      )}
      {reporting && <ReportSheet targetType="post" targetId={id} onClose={() => setReporting(false)} />}
    </main>
  );
}
