"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { YEARS, friendlyError } from "@/lib/format";
import type { Profile } from "@/lib/types";
import Field from "./Field";
import CollegeSearch, { placeOf, searchColleges, type CollegeHit } from "./CollegeSearch";

function slug(s: string) {
  const base = s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 44) || "college";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

/** "Harsha Vardhan Reddy" → ["Harsha", "Vardhan Reddy"]. */
function splitName(full: string): [string, string] {
  const t = full.trim().replace(/\s+/g, " ");
  const i = t.indexOf(" ");
  return i < 0 ? [t, ""] : [t.slice(0, i), t.slice(i + 1)];
}

export default function ProfileForm({ userId, initial, onDone, initialCollege, suggestions = [], suggestedName }: {
  userId: string; initial?: Profile | null; onDone?: () => void;
  /** For a new student: the first and last name from their Google account, to save typing. */
  suggestedName?: { first: string; last: string };
  /** The student's college now, or the one picked in "Pick your edition" on the landing page. */
  initialCollege?: CollegeHit | null;
  /** Shown before the student types: colleges already on Den. */
  suggestions?: CollegeHit[];
}) {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [first0, last0] = initial ? splitName(initial.name) : [suggestedName?.first || "", suggestedName?.last || ""];
  const [firstName, setFirstName] = useState(first0);
  const [lastName, setLastName] = useState(last0);
  const [picked, setPicked] = useState<CollegeHit | null>(initialCollege || null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCity, setNewCity] = useState("");
  const [lookalikes, setLookalikes] = useState<CollegeHit[]>([]);
  const [branch, setBranch] = useState(initial?.branch || "");
  const [year, setYear] = useState<string>(initial?.year || YEARS[0]);
  const [bio, setBio] = useState(initial?.bio || "");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // While adding a college, show existing ones with a similar name so students don't create duplicates.
  useEffect(() => {
    if (!adding || newName.trim().length < 3) { setLookalikes([]); return; }
    const t = window.setTimeout(() => { searchColleges(newName, 3).then(setLookalikes).catch(() => setLookalikes([])); }, 300);
    return () => window.clearTimeout(t);
  }, [adding, newName]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const name = `${firstName.trim()} ${lastName.trim()}`.trim().replace(/\s+/g, " ");
    if (!firstName.trim()) return setErr("Add your first name to continue.");
    if (!lastName.trim()) return setErr("Add your last name to continue. If you only have one name, add it in both boxes or use an initial.");
    if (!branch.trim()) return setErr("Add your branch or course to continue.");
    if (!picked && !adding) return setErr("Find your college, or add it if it isn't listed.");
    if (!initial && !agreed) return setErr("Confirm you're 18 or older and agree to the terms to continue.");
    if (adding && newName.trim().length < 2) return setErr("Add your college's name to continue.");
    setBusy(true); setErr("");
    let collegeId = picked?.id || "";
    if (adding) {
      collegeId = slug(newName);
      const { error } = await supabase.from("colleges").insert({ id: collegeId, name: newName.trim(), city: newCity.trim(), created_by: userId });
      if (error) { setBusy(false); return setErr(friendlyError(error, "Couldn't add your college. Try again.")); }
    }
    const row = { name, college_id: collegeId, branch: branch.trim(), year, bio: bio.trim() };
    const { error } = initial
      ? await supabase.from("profiles").update(row).eq("id", userId)
      : await supabase.from("profiles").insert({ id: userId, ...row, terms_accepted_at: new Date().toISOString() });
    setBusy(false);
    if (error) return setErr(friendlyError(error, "Couldn't save your profile. Try again."));
    if (onDone) onDone();
    router.replace(initial ? "/me" : `/c/${collegeId}`);
    router.refresh();
  }

  return (
    <form className="form" onSubmit={save}>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="pf-names">
        <Field id="pf-first" f={{ key: "first", label: "First name", type: "text", required: true, placeholder: "Harsha", max: 30 }} value={firstName} onChange={setFirstName} />
        <Field id="pf-last" f={{ key: "last", label: "Last name", type: "text", required: true, placeholder: "Vardhan", max: 30 }} value={lastName} onChange={setLastName} />
      </div>
      <div className="field">
        <label htmlFor="pf-college">College *</label>
        {adding ? (
          <div className="pf-add">
            <Field id="pf-cname" f={{ key: "cname", label: "College name", type: "text", required: true, max: 200, placeholder: "Full name, as on your ID card" }} value={newName} onChange={setNewName} />
            {lookalikes.length > 0 && (
              <div className="pf-like">
                <small>Is it one of these?</small>
                {lookalikes.map((c) => (
                  <button key={c.id} type="button" className="pf-like-btn" onClick={() => { setPicked(c); setAdding(false); }}>
                    <b>{c.name}</b><span>{placeOf(c)}</span>
                  </button>
                ))}
              </div>
            )}
            <Field id="pf-ccity" f={{ key: "ccity", label: "City", type: "text", max: 60 }} value={newCity} onChange={setNewCity} />
            <small>We&rsquo;ll check new colleges and tidy up the name if needed.</small>
            <button type="button" className="ghost" onClick={() => setAdding(false)}>Back to search</button>
          </div>
        ) : picked ? (
          <div className="pf-picked">
            <span><b>{picked.name}</b>{placeOf(picked) && <small>{placeOf(picked)}</small>}</span>
            <button type="button" className="ghost" onClick={() => setPicked(null)}>Change</button>
          </div>
        ) : (
          <CollegeSearch id="pf-college" onPick={setPicked} suggestions={suggestions} autoFocus={!initial}
            placeholder="Type your college: name, short name or city"
            footer={<button type="button" className="csearch-add" onClick={() => setAdding(true)}>Can&rsquo;t find your college? Add it</button>} />
        )}
        {initial && picked && picked.id !== initial.college_id && <small>Changing college moves you to that college&rsquo;s home page. Your old posts stay where they were.</small>}
      </div>
      <Field id="pf-branch" f={{ key: "branch", label: "Branch / course", type: "text", required: true, placeholder: "CSE, Mechanical, BCom, MBA...", max: 60 }} value={branch} onChange={setBranch} />
      <Field id="pf-year" f={{ key: "year", label: "Year", type: "select", options: YEARS }} value={year} onChange={setYear} />
      {initial && <Field id="pf-bio" f={{ key: "bio", label: "About you", type: "textarea", placeholder: "Clubs, interests, what you can help juniors with", max: 300 }} value={bio} onChange={setBio} />}
      {!initial && (
        <label className="agree">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>I&rsquo;m 18 or older, and I agree to Den&rsquo;s <a href="/terms" target="_blank">terms of use</a>, <a href="/privacy" target="_blank">privacy policy</a> and <a href="/guidelines" target="_blank">community guidelines</a>.</span>
        </label>
      )}
      <button className="primary" disabled={busy}>{busy ? "Saving..." : initial ? "Save profile" : "Join Den"}</button>
    </form>
  );
}
