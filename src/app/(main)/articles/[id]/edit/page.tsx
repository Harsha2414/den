"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Article } from "@/lib/types";
import { useApp } from "@/components/AppContext";
import ArticleEditor from "@/components/ArticleEditor";

export default function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me } = useApp();
  const [a, setA] = useState<Article | null | undefined>(undefined);
  useEffect(() => {
    supabaseBrowser().from("articles").select("*").eq("id", id).maybeSingle()
      .then(({ data }: { data: unknown }) => setA((data as Article) || null));
  }, [id]);
  if (a === undefined) return <main className="wrap page"><div className="empty" style={{ marginTop: 20 }}>Loading...</div></main>;
  if (!a || a.author_id !== me.id) {
    return <main className="wrap page"><div className="empty" style={{ marginTop: 20 }}>You can only edit your own articles.<Link className="secondary" href="/articles">See articles</Link></div></main>;
  }
  return <ArticleEditor key={a.id} article={a} />;
}
