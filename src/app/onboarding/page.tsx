import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getUser } from "@/lib/supabase/server";
import ProfileForm from "@/components/ProfileForm";
import type { CollegeHit } from "@/components/CollegeSearch";
import { EDITION_COOKIE, readEditionCookie } from "@/lib/edition";

export default async function OnboardingPage() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (profile) redirect("/");

  // The college picked in "Pick your edition" on the landing page, if any.
  const picked = readEditionCookie((await cookies()).get(EDITION_COOKIE)?.value);
  const [{ data: chosen }, { data: active }] = await Promise.all([
    picked ? supabase.from("colleges").select("id,name,city,state").eq("id", picked.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.rpc("active_colleges"),
  ]);

  return (
    <main className="onb">
      <h1>Welcome<span>to Den.</span></h1>
      <p>Tell students who you are. You can change this later from your profile.</p>
      <ProfileForm userId={user.id} suggestedName={nameFromAccount(user.user_metadata)} initialCollege={(chosen as CollegeHit | null) || null} suggestions={((active as CollegeHit[] | null) || []).slice(0, 8)} />
    </main>
  );
}

/** Google gives a first name (given_name) and last name (family_name); email sign-ins have none. */
function nameFromAccount(meta: Record<string, unknown> | undefined) {
  const s = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 30) : "");
  const first = s(meta?.given_name), last = s(meta?.family_name);
  if (first || last) return { first, last };
  const full = s(meta?.full_name) || s(meta?.name);
  const i = full.indexOf(" ");
  return full ? (i < 0 ? { first: full, last: "" } : { first: full.slice(0, i), last: full.slice(i + 1) }) : undefined;
}
