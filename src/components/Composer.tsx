"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/format";
import { SECTIONS, type SectionKey } from "@/lib/sections";
import { useApp } from "./AppContext";
import { useToast } from "./Toast";
import Field from "./Field";
import Sheet from "./Sheet";

export default function Composer({ section, defaultIndia, onClose, onPosted }: {
  section: SectionKey; defaultIndia: boolean; onClose: () => void; onPosted: () => void;
}) {
  const { me, collegeName } = useApp();
  const toast = useToast();
  const sec = SECTIONS[section];
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(sec.fields.map((f) => [
    f.key,
    f.key === "visibility" ? (defaultIndia ? "All India" : "My college") : f.initial ?? (f.type === "select" ? f.options![0] : ""),
  ])));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = Object.fromEntries(Object.entries(values).map(([k, x]) => [k, x.trim()]));
    const missing = sec.fields.find((f) => f.required && !v[f.key]);
    if (missing) return setErr(`Add "${missing.label}" to continue.`);
    const row = sec.toRow(v);
    if (typeof row === "string") return setErr(row);
    setBusy(true); setErr("");
    const { error } = await supabaseBrowser().from(section).insert({ ...row, college_id: me.college_id });
    setBusy(false);
    if (error) return setErr(friendlyError(error, "Couldn't post that. Try again."));
    toast("Posted");
    onPosted();
  }

  return (
    <Sheet title={sec.cta} onClose={onClose}>
      <p className="note">Posting to {collegeName(me.college_id)}.</p>
      <form className="form" onSubmit={submit}>
        {err && <p className="err" role="alert">{err}</p>}
        {sec.fields.map((f) => (
          <Field key={f.key} id={`c-${section}-${f.key}`} f={f} value={values[f.key]} onChange={(x) => setValues((s) => ({ ...s, [f.key]: x }))} />
        ))}
        <button className="primary" disabled={busy}>{busy ? "Posting..." : "Post"}</button>
      </form>
    </Sheet>
  );
}
