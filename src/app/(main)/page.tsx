import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";

export default async function Home() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("profiles").select("college_id").eq("id", user.id).maybeSingle();
  redirect(data ? `/c/${data.college_id}` : "/onboarding");
}
