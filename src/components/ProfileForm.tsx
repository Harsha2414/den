"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { YEARS, friendlyError } from "@/lib/format";
import type { College, Profile } from "@/lib/types";
import Field from "./Field";

const NEW = "__new";

function slug(s: string) {
  const base = s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 44) || "college";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function ProfileForm({ userId, colleges, initial, onDone }: {
  userId: string; colleges: College[]; initial?: Profile | null; onDone?: () => void;
}) {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const sorted = useMemo(() => [...colleges].sort((a, b) => a.name.localeCompare(b.name)), [colleges]);
  const [name, setName] = useState(initial?.name || "");
  const [college, setCollege] = useState(initial?.college_id || "");
  const [newName, setNewName] = useState("");
  const [newCity, setNewCity] = useState("");
  const [branch, setBranch] = useState(initial?.branch || "");
  const [year, setYear] = useState<string>(initial?.year || YEARS[0]);
  const [bio, setBio] = useState(initial?.bio || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !branch.trim()) return setErr("Add your name and branch to continue.");
    if (!college) return setErr("Choose your college.");
    if (college === NEW && newName.trim().length < 2) return setErr("Add your college's name to continue.");
    setBusy(true); setErr("");
    let collegeId = college;
    if (college === NEW) {
      collegeId = slug(newName);
      const { error } = await supabase.from("colleges").insert({ id: collegeId, name: newName.trim(), city: newCity.trim(), created_by: userId });
      if (error) { setBusy(false); return setErr(friendlyError(error, "Couldn't add your college. Try again.")); }
    }
    const row = { name: name.trim(), college_id: collegeId, branch: branch.trim(), year, bio: bio.trim() };
    const { error } = initial
      ? await supabase.from("profiles").update(row).eq("id", userId)
      : await supabase.from("profiles").insert({ id: userId, ...row });
    setBusy(false);
    if (error) return setErr(friendlyError(error, "Couldn't save your profile. Try again."));
    if (onDone) onDone();
    router.replace(initial ? "/me" : `/c/${collegeId}`);
    router.refresh();
  }

  return (
    <form className="form" onSubmit={save}>
      {err && <p className="err" role="alert">{err}</p>}
      <Field id="pf-name" f={{ key: "name", label: "Your name", type: "text", required: true, placeholder: "How friends and juniors will see you", max: 60 }} value={name} onChange={setName} />
      <div className="field">
        <label htmlFor="pf-college">College *</label>
        <select id="pf-college" value={college} onChange={(e) => setCollege(e.target.value)}>
          <option value="" disabled>Choose your college</option>
          {sorted.map((c) => <option key={c.id} value={c.id}>{c.name}{c.city ? `, ${c.city}` : ""}</option>)}
          <option value={NEW}>My college isn't listed</option>
        </select>
        {initial && college !== initial.college_id && <small>Changing college moves you to that college's home page. Your old posts stay where they were.</small>}
      </div>
      {college === NEW && (
        <>
          <Field id="pf-cname" f={{ key: "cname", label: "College name", type: "text", required: true, max: 120 }} value={newName} onChange={setNewName} />
          <Field id="pf-ccity" f={{ key: "ccity", label: "City", type: "text", max: 60 }} value={newCity} onChange={setNewCity} />
        </>
      )}
      <Field id="pf-branch" f={{ key: "branch", label: "Branch / course", type: "text", required: true, placeholder: "CSE, Mechanical, BCom, MBA...", max: 60 }} value={branch} onChange={setBranch} />
      <Field id="pf-year" f={{ key: "year", label: "Year", type: "select", options: YEARS }} value={year} onChange={setYear} />
      {initial && <Field id="pf-bio" f={{ key: "bio", label: "About you", type: "textarea", placeholder: "Clubs, interests, what you can help juniors with", max: 300 }} value={bio} onChange={setBio} />}
      <button className="primary" disabled={busy}>{busy ? "Saving..." : initial ? "Save profile" : "Join Den"}</button>
    </form>
  );
}
