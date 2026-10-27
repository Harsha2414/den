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

/** One post on its own page: where a shared post link opens. */
export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me, college, ensureCollege } = useApp();
  const gate = useGate();
  const toast = useToast();
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [post, setPost] = useState<Post | null | undefined>(undefined);
  const [likes, setLikes] = useState({ n: 0, mine: false });
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const { data } = await supabase.from("posts").select(`*, author:profiles!posts_author_id_fkey(${AUTHOR_COLS}), comments(count)`).eq("id", id).maybeSingle();
      if (!live) return;
      setPost((data as Post | null) || null);
      if (data) {
        ensureCollege((data as Post).college_id);
        const { data: ls } = await supabase.from("likes").select("user_id").eq("item_type", "post").eq("item_id", id);
        if (live) setLikes({ n: (ls || []).length, mine: (ls || []).some((l: { user_id: string }) => l.user_id === me.id) });
      }
    })();
    return () => { live = false; };
  }, [id, me.id, supabase, ensureCollege]);

  async function toggleLike() {
    if (!gate("like posts")) return;
    const cur = likes;
    setLikes({ n: cur.n + (cur.mine ? -1 : 1), mine: !cur.mine });
    const res = cur.mine
      ? await supabase.from("likes").delete().match({ user_id: me.id, item_type: "post", item_id: id })
      : await supabase.from("likes").insert({ item_type: "post", item_id: id });
    if (res.error) { setLikes(cur); toast(friendlyError(res.error)); }
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
          <ItemCard type="posts" item={post} likes={likes.n} liked={likes.mine} showCollege={post.college_id !== me.college_id} openComments
            actions={{ onLike: toggleLike, onDelete: remove, onReport: () => setReporting(true) }} />
        </div>
      )}
      {reporting && <ReportSheet targetType="post" targetId={id} onClose={() => setReporting(false)} />}
    </main>
  );
}
