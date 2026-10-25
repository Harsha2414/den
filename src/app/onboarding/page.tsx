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
      <ProfileForm userId={user.id} initialCollege={(chosen as CollegeHit | null) || null} suggestions={((active as CollegeHit[] | null) || []).slice(0, 8)} />
    </main>
  );
}
