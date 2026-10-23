import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { AppProvider } from "@/components/AppContext";
import { ChromeShell } from "@/components/Chrome";
import type { College, Profile } from "@/lib/types";
import TermsGate from "@/components/TermsGate";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, { data: colleges }] = await Promise.all([
    // select("*") so the app keeps working even before the terms_accepted_at column is added
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("colleges").select("id,name,city").order("name"),
  ]);
  if (!profile) redirect("/onboarding");

  return (
    <AppProvider me={profile as Profile} colleges={(colleges || []) as College[]}>
      {(profile as Profile).terms_accepted_at === null ? (
        <TermsGate userId={user.id} />
      ) : (
        <ChromeShell>{children}</ChromeShell>
      )}
    </AppProvider>
  );
}
