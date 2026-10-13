import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import ProfileForm from "@/components/ProfileForm";

export default async function OnboardingPage() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (profile) redirect("/");
  const { data: colleges } = await supabase.from("colleges").select("id,name,city").order("name");

  return (
    <main className="onb">
      <h1>Welcome<span>to Den.</span></h1>
      <p>Tell students who you are. You can change this later from your profile.</p>
      <ProfileForm userId={user.id} colleges={colleges || []} />
    </main>
  );
}
