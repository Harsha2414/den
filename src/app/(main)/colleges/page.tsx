"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppContext";
import CollegeSearch from "@/components/CollegeSearch";

export default function CollegesPage() {
  const { colleges, me } = useApp();
  const router = useRouter();
  const onDen = [...colleges].sort((a, b) => (b.students || 0) - (a.students || 0) || a.name.localeCompare(b.name));

  return (
    <main className="wrap page">
      <div className="sec-head"><h2>Browse colleges</h2><small>Every college in India</small></div>
      <CollegeSearch className="browse-search" autoFocus placeholder="Search any college: name, short name or city"
        onPick={(c) => router.push(`/c/${c.id}`)} />
      <Link href="/india" className="pick"><div><b>All India</b><span>Posts shared with every campus</span></div></Link>
      <div className="switch-label" style={{ marginTop: 18 }}>On Den now</div>
      {onDen.map((c) => (
        <Link key={c.id} href={`/c/${c.id}`} className="pick">
          <div>
            <b>{c.name}{c.id === me.college_id ? " (your college)" : ""}</b>
            <span>{[c.city, c.state].filter(Boolean).join(", ")}{c.students ? ` · ${c.students} ${c.students === 1 ? "student" : "students"}` : ""}</span>
          </div>
        </Link>
      ))}
    </main>
  );
}
