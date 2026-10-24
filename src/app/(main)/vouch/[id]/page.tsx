"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { AUTHOR_COLS, friendlyError } from "@/lib/format";
import type { Author } from "@/lib/types";
import { useApp } from "@/components/AppContext";
import { VouchCard } from "@/components/Gate";

/** Opened from a WhatsApp link: "Can you confirm I study here?" */
export default function VouchLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me, collegeName } = useApp();
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [who, setWho] = useState<Author | null | undefined>(undefined);
  const [done, setDone] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (id === me.id) { router.replace("/verify/classmates"); return; }
    supabase.from("profiles").select(AUTHOR_COLS).eq("id", id).maybeSingle().then(({ data }: { data: unknown }) => setWho((data as Author) || null));
  }, [id, me.id, router, supabase]);

  async function answer(a: "yes" | "no" | "unsure") {
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("answer_vouch", { requester: id, answer: a });
    setBusy(false);
    if (error) return setErr(friendlyError(error, "Couldn't save your answer."));
    setDone(a === "yes" ? `Thanks. You vouched for ${who?.name.split(" ")[0]}.` : "Thanks for answering.");
  }

  const box = (children: React.ReactNode) => <main className="wrap page" style={{ paddingTop: 16 }}>{children}</main>;
  if (who === undefined) return box(<div className="empty">Loading...</div>);
  if (!who) return box(<div className="empty">This student isn&rsquo;t on Den anymore.</div>);
  if (who.verified) return box(<div className="empty">{who.name} is already verified. Thanks anyway!<Link className="secondary" href={`/c/${me.college_id}`}>Go home</Link></div>);
  if (who.college_id !== me.college_id) return box(<div className="empty">{who.name} studies at {collegeName(who.college_id)}. Only their classmates can vouch for them.</div>);
  if (!me.verified) return box(<div className="empty">You need to be verified yourself before you can vouch for others.<Link className="secondary" href="/verify">Get verified</Link></div>);
  if (done) return box(<div className="empty">{done}<Link className="secondary" href={`/c/${me.college_id}`}>Go home</Link></div>);
  return box(<>
    <VouchCard who={who} onAnswer={answer} busy={busy} />
    {err && <p className="err" role="alert" style={{ marginTop: 10 }}>{err}</p>}
  </>);
}
