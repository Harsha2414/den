import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import ScopeHome from "@/components/ScopeHome";

export default async function CollegePage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; new?: string }>;
}) {
  const [{ id }, { tab, new: startNew }] = await Promise.all([params, searchParams]);
  const supabase = await supabaseServer();
  const { data } = await supabase.from("colleges").select("id").eq("id", id).maybeSingle();
  if (!data) notFound();
  return <ScopeHome key={`${id}:${tab || ""}`} scope={id} initialTab={tab} startComposing={startNew === "1"} />;
}
