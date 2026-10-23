import Link from "next/link";
import { supabaseServer } from "@/lib/server";

type O = {
  students: number; verified: number; new_7d: number; new_today: number; colleges_active: number; banned: number;
  cards_waiting: number; cards_unclear: number; flags_waiting: number; reports_open: number; posts_7d: number;
  by_method: Record<string, number>; top_colleges: { name: string; n: number }[];
};
const METHOD: Record<string, string> = { email: "College email sign-in", college_email: "College email code", id_card: "ID card", classmates: "Classmates", admin: "Given by admin", none: "Not verified" };
const n = (x: number) => (x || 0).toLocaleString("en-IN");

export default async function Overview() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("admin_overview");
  if (error) return <div className="page"><h1>Overview</h1><p className="err">Couldn&rsquo;t load: {error.message}. Has migration 0005 been run in Supabase?</p></div>;
  const o = data as O;
  const pct = o.students ? Math.round((o.verified / o.students) * 100) : 0;
  const methods = Object.entries(o.by_method || {}).sort((a, b) => b[1] - a[1]);
  const maxM = Math.max(1, ...methods.map((m) => m[1]));
  const maxC = Math.max(1, ...(o.top_colleges || []).map((c) => c.n));
  return (
    <div className="page">
      <h1>Overview</h1>
      <div className="todo">
        <Link href="/verification" className={o.cards_waiting ? "hot" : ""}><b>{n(o.cards_waiting)}</b><span>ID cards to check{o.cards_unclear ? ` · ${o.cards_unclear} unclear` : ""}</span></Link>
        <Link href="/verification?tab=flags" className={o.flags_waiting ? "hot" : ""}><b>{n(o.flags_waiting)}</b><span>Classmate flags</span></Link>
        <Link href="/reports" className={o.reports_open ? "hot" : ""}><b>{n(o.reports_open)}</b><span>Open reports</span></Link>
      </div>
      <div className="tiles">
        <div><span>Students</span><b>{n(o.students)}</b><small>+{n(o.new_today)} today · +{n(o.new_7d)} this week</small></div>
        <div><span>Verified</span><b>{n(o.verified)}</b><small>{pct}% of all students</small></div>
        <div><span>Colleges with students</span><b>{n(o.colleges_active)}</b></div>
        <div><span>Posts this week</span><b>{n(o.posts_7d)}</b></div>
        <div><span>Banned</span><b>{n(o.banned)}</b></div>
      </div>
      <div className="two">
        <section className="panel">
          <h2>How students are verified</h2>
          {methods.map(([k, v]) => (
            <div className="bar" key={k}><span>{METHOD[k] || k}</span><i style={{ width: `${(v / maxM) * 100}%` }} className={k === "none" ? "muted" : ""} /><b>{n(v)}</b></div>
          ))}
        </section>
        <section className="panel">
          <h2>Biggest colleges</h2>
          {(o.top_colleges || []).map((c) => (
            <div className="bar" key={c.name}><span>{c.name}</span><i style={{ width: `${(c.n / maxC) * 100}%` }} /><b>{n(c.n)}</b></div>
          ))}
        </section>
      </div>
    </div>
  );
}
