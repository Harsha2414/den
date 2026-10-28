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
import { toStored } from "@/lib/mentions";
import MentionBox from "./MentionBox";
import Icon from "./Icon";

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
  const [picked, setPicked] = useState<Record<string, string>>({});
  // Posts can carry a poll: 2 to 4 options.
  const [poll, setPoll] = useState<string[] | null>(null);
  const isPost = section === "posts" && !editId;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (uploading) return setErr("Wait for the upload to finish.");
    const v = Object.fromEntries(Object.entries(values).map(([k, x]) => [k, x.trim()]));
    if (section === "posts" && v.body) v.body = toStored(v.body, picked);
    const options = (poll || []).map((o) => o.trim()).filter(Boolean);
    if (isPost && poll) {
      if (!v.body) return setErr("Write the poll question in the post.");
      if (options.length < 2) return setErr("Add at least two poll options.");
      if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return setErr("Poll options must be different.");
    }
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
    if (isPost && poll && data) {
      const { error: pe } = await supabase.from("polls").insert({ post_id: (data as { id: string }).id, options });
      if (pe) toast("Posted, but the poll couldn't be added.");
    }
    toast(editId ? "Saved" : "Posted");
    onPosted((data as { id: string } | null)?.id);
  }

  return (
    <Sheet title={editId ? "Edit" : sec.cta} onClose={onClose}>
      {!editId && <p className="note">Posting to {collegeName(me.college_id)}.</p>}
      <form className="form" onSubmit={submit}>
        {err && <p className="err" role="alert">{err}</p>}
        {sec.fields.map((f) => section === "posts" && f.key === "body" ? (
          <div className="field" key={f.key}>
            <label htmlFor={`c-${section}-${f.key}`}>{poll ? "Poll question" : f.label}</label>
            <MentionBox multiline id={`c-${section}-${f.key}`} value={values[f.key]} maxLength={f.max} placeholder={poll ? "Which elective is easier to score in?" : f.placeholder}
              onChange={(x) => setValues((s) => ({ ...s, [f.key]: x }))} picked={picked} onPick={(n, id) => setPicked((p) => ({ ...p, [n]: id }))} />
            <small>Type @ to mention a classmate.</small>
            {isPost && (poll ? (
              <div className="poll-build">
                {poll.map((o, i) => (
                  <div className="poll-build-row" key={i}>
                    <input value={o} maxLength={60} placeholder={`Option ${i + 1}`} aria-label={`Option ${i + 1}`}
                      onChange={(e) => setPoll((p) => p!.map((x, j) => (j === i ? e.target.value : x)))} />
                    {poll.length > 2 && <button type="button" className="ghost" aria-label={`Remove option ${i + 1}`} onClick={() => setPoll((p) => p!.filter((_, j) => j !== i))}><Icon name="x" size={16} /></button>}
                  </div>
                ))}
                <div className="poll-build-acts">
                  {poll.length < 4 && <button type="button" className="link-btn" onClick={() => setPoll((p) => [...p!, ""])}><Icon name="plus" size={15} /> Add option</button>}
                  <button type="button" className="link-btn" onClick={() => setPoll(null)}>Remove poll</button>
                </div>
              </div>
            ) : (
              <button type="button" className="link-btn poll-add" onClick={() => setPoll(["", ""])}><Icon name="chart" size={15} /> Add a poll</button>
            ))}
          </div>
        ) : f.type === "media" ? (
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
