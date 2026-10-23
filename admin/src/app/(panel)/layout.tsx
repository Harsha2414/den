import { emailAllowed, supabaseServer } from "@/lib/server";
import Shell from "@/components/Shell";
import NotAdmin from "@/components/NotAdmin";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <NotAdmin email="" />;
  const { data: me } = await supabase.from("profiles").select("id,name,is_admin").eq("id", user.id).maybeSingle<{ id: string; name: string; is_admin: boolean }>();
  if (!me?.is_admin || !emailAllowed(user.email)) return <NotAdmin email={user.email || ""} />;
  const [{ data: colleges }, { data: overview }] = await Promise.all([
    supabase.from("colleges").select("id,name").order("name"),
    supabase.rpc("admin_overview"),
  ]);
  const o = (overview || {}) as { cards_waiting?: number; flags_waiting?: number; reports_open?: number };
  return (
    <Shell me={{ id: me.id, name: me.name, email: user.email || "" }} colleges={(colleges || []) as { id: string; name: string }[]}
      counts={{ verification: (o.cards_waiting || 0) + (o.flags_waiting || 0), reports: o.reports_open || 0 }}
      denUrl={process.env.NEXT_PUBLIC_DEN_URL || "https://den-sable.vercel.app"}>
      {children}
    </Shell>
  );
}
