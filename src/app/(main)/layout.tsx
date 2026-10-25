import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { AppProvider } from "@/components/AppContext";
import { ChromeShell } from "@/components/Chrome";
import type { Access, College, Profile } from "@/lib/types";
import Suspended from "@/components/Suspended";
import QueryProvider from "@/components/QueryProvider";
import TermsGate from "@/components/TermsGate";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const [{ data: profile }, active, { data: access }] = await Promise.all([
    // select("*") so the app keeps working even before the terms_accepted_at column is added
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    // Colleges with students on Den. The full India list (~70,000) is searched when needed, never loaded whole.
    supabase.rpc("active_colleges"),
    // null until migration 0005 is run; the app then treats college-email students as verified
    supabase.rpc("my_access"),
  ]);
  if (!profile) redirect("/onboarding");
  // Before migration 0008 is run, fall back to the old full list.
  const colleges = active.error ? (await supabase.from("colleges").select("id,name,city").order("name")).data : active.data;

  return (
    <AppProvider me={profile as Profile} colleges={(colleges || []) as College[]} access={(access as Access | null) || undefined}>
      {(access as Access | null)?.level === "banned" ? (
        <Suspended />
      ) : (profile as Profile).terms_accepted_at === null ? (
        <TermsGate userId={user.id} />
      ) : (
        <QueryProvider><ChromeShell>{children}</ChromeShell></QueryProvider>
      )}
    </AppProvider>
  );
}
