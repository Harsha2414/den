"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";
import { supabaseBrowser } from "@/lib/supabase";

type Ctx = { me: { id: string; name: string; email: string }; collegeName: (id: string) => string; denUrl: string };
const C = createContext<Ctx | null>(null);
export const useAdmin = () => useContext(C)!;

const NAV = [
  { href: "/", label: "Overview", key: "" },
  { href: "/verification", label: "Verification", key: "verification" },
  { href: "/reports", label: "Reports", key: "reports" },
  { href: "/students", label: "Students", key: "" },
  { href: "/colleges", label: "Colleges", key: "colleges" },
];

export default function Shell({ me, colleges, counts, denUrl, children }: {
  me: Ctx["me"]; colleges: { id: string; name: string }[]; counts: Record<string, number>; denUrl: string; children: ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const map = new Map(colleges.map((c) => [c.id, c.name]));
  async function out() { await supabaseBrowser().auth.signOut(); router.replace("/login"); router.refresh(); }
  return (
    <C.Provider value={{ me, collegeName: (id) => map.get(id) || id, denUrl }}>
      <div className="shell">
        <aside className="nav">
          <div className="brand">Den<span>.</span> <em>Admin</em></div>
          <nav>
            {NAV.map((n) => {
              const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
              const c = n.key ? counts[n.key] : 0;
              return <Link key={n.href} href={n.href} className={on ? "on" : ""}>{n.label}{c ? <span className="count">{c}</span> : null}</Link>;
            })}
          </nav>
          <div className="nav-foot">
            <a href={denUrl} target="_blank" rel="noopener noreferrer">Open Den ↗</a>
            <div className="who"><b>{me.name}</b><span>{me.email}</span></div>
            <button className="btn small" onClick={out}>Sign out</button>
          </div>
        </aside>
        <div className="main">{children}</div>
      </div>
    </C.Provider>
  );
}
