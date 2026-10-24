"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useApp } from "@/components/AppContext";
import Icon, { VerifiedTick } from "@/components/Icon";

/** Shrink the photo before upload: faster on mobile data, cheaper to check, and enough detail to read. */
async function shrink(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error("encode"))), "image/jpeg", 0.85));
  } finally { URL.revokeObjectURL(url); }
}

export default function VerifyIdPage() {
  const { me, collegeName } = useApp();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [name, setName] = useState(me.name);
  const [stage, setStage] = useState<"pick" | "checking" | "verified" | "review">("pick");
  const [err, setErr] = useState("");

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function onFile(f: File | undefined) {
    setErr("");
    if (!f) return;
    if (!/^image\//.test(f.type)) return setErr("Choose a photo (JPG or PNG).");
    try {
      const b = await shrink(f);
      setBlob(b); setPreview(URL.createObjectURL(b));
    } catch { setErr("Couldn't open that photo. Try another one."); }
  }

  async function submit() {
    if (!blob) return setErr("Add a photo of your card first.");
    if (name.trim().length < 2) return setErr("Type your name as it's printed on the card.");
    setErr(""); setStage("checking");
    const path = `${me.id}/${crypto.randomUUID()}.jpg`;
    const up = await supabaseBrowser().storage.from("id-cards").upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (up.error) { setStage("pick"); return setErr("Couldn't upload the photo. Check your connection and try again."); }
    const res = await fetch("/api/verify/id", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, name: name.trim() }) }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) { setStage("pick"); return setErr(j.error || "Something went wrong. Try again."); }
    setStage(j.result === "verified" ? "verified" : "review");
    router.refresh();
  }

  if (stage === "verified") {
    return (
      <main className="wrap page"><div className="done-state">
        <div className="done-badge"><Icon name="check" size={44} /></div>
        <h1>You&rsquo;re verified</h1>
        <p className="meta"><b style={{ color: "var(--ink)" }}>{me.name}</b><VerifiedTick /> · your card matched {collegeName(me.college_id)}.</p>
        <p className="note" style={{ maxWidth: 380, margin: "12px auto 0" }}>A Den reviewer also takes a quick look at every card within a day. If something&rsquo;s wrong, the tick may be removed. The photo is deleted after that.</p>
        <Link className="primary" href={`/c/${me.college_id}`} style={{ marginTop: 18 }}>Go to {collegeName(me.college_id) || "your college"}</Link>
      </div></main>
    );
  }
  if (stage === "review") {
    return (
      <main className="wrap page"><div className="done-state">
        <div className="done-badge wait"><Icon name="clock" size={40} /></div>
        <h1>A person will check your card</h1>
        <p className="meta" style={{ maxWidth: 380, margin: "0 auto" }}>We couldn&rsquo;t confirm everything automatically, so a Den reviewer will look at it, usually within a day. You&rsquo;ll get the blue tick as soon as it&rsquo;s approved.</p>
        <Link className="secondary" href="/verify/classmates" style={{ marginTop: 18 }}>Meanwhile, ask classmates</Link>
      </div></main>
    );
  }

  return (
    <main className="wrap page">
      <div className="row" style={{ marginTop: 12 }}><Link href="/verify" className="ghost"><Icon name="back" size={16} /> Get verified</Link></div>
      <div className="page-head"><h1>Student ID card</h1><span>A clear photo of the front of your {collegeName(me.college_id) || "college"} ID.</span></div>

      <button type="button" className={`card-drop ${preview ? "has" : ""}`} onClick={() => inputRef.current?.click()} disabled={stage === "checking"}>
        {preview ? <img src={preview} alt="Your ID card" /> : (
          <span><Icon name="camera" size={34} /><b>Take or choose a photo</b><small>Front of the card</small></span>
        )}
        {preview && <em>Retake</em>}
      </button>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />

      <div className="tips"><span><Icon name="check" size={15} /> Whole card in view</span><span><Icon name="check" size={15} /> Good light, no glare</span><span><Icon name="check" size={15} /> Not a screenshot</span></div>

      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="cardname">Your name as printed on the card</label>
        <input id="cardname" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </div>

      <p className="note" style={{ marginTop: 12 }}><Icon name="lock" size={13} /> Only Den&rsquo;s reviewers can see this photo. It&rsquo;s <b style={{ color: "var(--ink)" }}>deleted after it&rsquo;s checked</b> (7 days at most). We don&rsquo;t keep your roll number.</p>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="primary" style={{ marginTop: 12 }} disabled={stage === "checking" || !blob} onClick={submit}>
        {stage === "checking" ? "Checking your card..." : "Submit card"}
      </button>
    </main>
  );
}
