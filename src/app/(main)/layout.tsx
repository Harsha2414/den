import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { AppProvider } from "@/components/AppContext";
import { BottomNav, TopBar } from "@/components/Chrome";
import type { College, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: colleges }] = await Promise.all([
    supabase.from("profiles").select("id,name,college_id,branch,year,bio,verified,is_admin").eq("id", user.id).maybeSingle(),
    supabase.from("colleges").select("id,name,city").order("name"),
  ]);
  if (!profile) redirect("/onboarding");

  return (
    <AppProvider me={profile as Profile} colleges={(colleges || []) as College[]}>
      <TopBar />
      {children}
      <BottomNav />
    </AppProvider>
  );
}
