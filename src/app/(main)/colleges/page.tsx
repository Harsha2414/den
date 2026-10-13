"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/AppContext";
import Icon from "@/components/Icon";

export default function CollegesPage() {
  const { colleges, me } = useApp();
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return [...colleges].sort((a, b) => a.name.localeCompare(b.name))
      .filter((c) => !s || `${c.name} ${c.city}`.toLowerCase().includes(s));
  }, [colleges, q]);

  return (
    <main className="wrap page">
      <div className="sec-head"><h2>Browse colleges</h2><small>{colleges.length} colleges</small></div>
      <div className="search">
        <Icon name="search" size={17} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by college or city" aria-label="Search colleges" />
      </div>
      <Link href="/india" className="pick"><div><b>All India</b><span>Posts shared with every campus</span></div></Link>
      {list.map((c) => (
        <Link key={c.id} href={`/c/${c.id}`} className="pick">
          <div><b>{c.name}{c.id === me.college_id ? " (your college)" : ""}</b><span>{c.city}</span></div>
        </Link>
      ))}
      {list.length === 0 && <p className="note" style={{ marginTop: 12 }}>No college found. Students can add theirs when they sign up or from their profile.</p>}
    </main>
  );
}
