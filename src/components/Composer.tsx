"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/format";
import { SECTIONS, type SectionKey } from "@/lib/sections";
import { useApp } from "./AppContext";
import { useToast } from "./Toast";
import Field from "./Field";
import Sheet from "./Sheet";
import { MediaPicker } from "./Media";
import { parseMedia } from "@/lib/media";

export default function Composer({ section, defaultIndia, onClose, onPosted, editId, initial }: {
  section: SectionKey; defaultIndia: boolean; onClose: () => void;
  /** Called with the new or edited row's id. */
  onPosted: (id?: string) => void;
  /** When set, the form edits this row instead of creating a new one. */
  editId?: string;
  initial?: Record<string, string>;
}) {
  const { me, collegeName } = useApp();
  const toast = useToast();
  const sec = SECTIONS[section];
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(sec.fields.map((f) => [
    f.key,
    initial?.[f.key] ?? (f.key === "visibility" ? (defaultIndia ? "All India" : "My college") : f.initial ?? (f.type === "select" ? f.options![0] : "")),
  ])));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (uploading) return setErr("Wait for the upload to finish.");
    const v = Object.fromEntries(Object.entries(values).map(([k, x]) => [k, x.trim()]));
    const missing = sec.fields.find((f) => f.required && !v[f.key]);
    if (missing) return setErr(`Add "${missing.label}" to continue.`);
    const row = sec.toRow(v);
    if (typeof row === "string") return setErr(row);
    setBusy(true); setErr("");
    const supabase = supabaseBrowser();
    const { data, error } = editId
      ? await supabase.from(section).update(row).eq("id", editId).select("id").maybeSingle()
      : await supabase.from(section).insert({ ...row, college_id: me.college_id }).select("id").single();
    setBusy(false);
    if (error) return setErr(friendlyError(error, editId ? "Couldn't save your changes. Try again." : "Couldn't post that. Try again."));
    if (editId && !data) return setErr("You can't edit this anymore.");
    toast(editId ? "Saved" : "Posted");
    onPosted((data as { id: string } | null)?.id);
  }

  return (
    <Sheet title={editId ? "Edit" : sec.cta} onClose={onClose}>
      {!editId && <p className="note">Posting to {collegeName(me.college_id)}.</p>}
      <form className="form" onSubmit={submit}>
        {err && <p className="err" role="alert">{err}</p>}
        {sec.fields.map((f) => f.type === "media" ? (
          <MediaPicker key={f.key} label={f.label} accept={f.accept} max={f.maxItems} value={parseMedia(values[f.key])} onBusy={setUploading}
            onChange={(m) => setValues((s) => ({ ...s, [f.key]: JSON.stringify(m) }))} />
        ) : (
          <Field key={f.key} id={`c-${section}-${f.key}`} f={f} value={values[f.key]} onChange={(x) => setValues((s) => ({ ...s, [f.key]: x }))} />
        ))}
        <button className="primary" disabled={busy || uploading}>{busy ? (editId ? "Saving..." : "Posting...") : editId ? "Save changes" : section === "events" ? "Create event" : "Post"}</button>
      </form>
    </Sheet>
  );
}
