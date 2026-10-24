"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useApp } from "@/components/AppContext";
import Icon, { VerifiedTick, type IconName } from "@/components/Icon";

type Check = { status: string; ai_verdict: string; reject_reason: string; created_at: string };
const VIA: Record<string, string> = { email: "your college email sign-in", college_email: "your college email", id_card: "your student ID card", classmates: "your classmates", admin: "a Den moderator" };

export default function VerifyPage() {
  const { me, access } = useApp();
  const supabase = supabaseBrowser();
  const [check, setCheck] = useState<Check | null>(null);
  const [yes, setYes] = useState(0);
  useEffect(() => {
    supabase.from("id_checks").select("status,ai_verdict,reject_reason,created_at").eq("user_id", me.id).order("created_at", { ascending: false }).limit(1)
      .then(({ data }: { data: Check[] | null }) => setCheck(data?.[0] || null));
    supabase.from("vouches").select("status").eq("requester_id", me.id)
      .then(({ data }: { data: { status: string }[] | null }) => setYes((data || []).filter((v) => v.status === "yes").length));
  }, [supabase, me.id]);

  if (me.verified) {
    return (
      <main className="wrap page"><div className="done-state">
        <div className="done-badge"><Icon name="check" size={44} /></div>
        <h1>You&rsquo;re verified</h1>
        <p className="meta"><b style={{ color: "var(--ink)" }}>{me.name}</b><VerifiedTick /> · verified by {VIA[me.verified_via || "email"] || "Den"}.</p>
        <Link className="primary" href={`/c/${me.college_id}`} style={{ marginTop: 18 }}>Go to your college</Link>
      </div></main>
    );
  }

  const pending = check?.status === "pending";
  const rejected = check?.status === "rejected";
  const option = (href: string, icon: IconName, title: string, chip: string, desc: string, best?: boolean) => (
    <Link href={href} className={`verify-opt ${best ? "best" : ""}`}>
      <span className="vo-icon"><Icon name={icon} size={24} /></span>
      <span className="vo-text"><span className="vo-title"><b>{title}</b><em>{chip}</em></span><span>{desc}</span></span>
      <Icon name="chevRight" size={18} />
    </Link>
  );

  return (
    <main className="wrap page">
      <div className="page-head"><h1>Show you&rsquo;re a student</h1><span>Pick any one. You&rsquo;ll keep signing in the same way.</span></div>
      {access.level === "grace" && access.grace_until && (
        <p className="warn">You can keep posting until {new Date(access.grace_until).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}. After that, only verified students can post, comment, like and message.</p>
      )}
      {pending && <p className="notice"><b>Your ID card is being checked.</b> A reviewer will look at it within a day, and the tick appears as soon as it&rsquo;s approved.</p>}
      {rejected && <p className="warn"><b>Your last ID card wasn&rsquo;t accepted</b>{check?.reject_reason ? `: ${check.reject_reason}` : "."} You can try again or use another way.</p>}
      <div className="verify-opts">
        {option("/verify/email", "mail", "College email", "30 seconds", "Have an email from your college (like name@college.ac.in)? We send it a 6-digit code.", true)}
        {!pending && option("/verify/id", "idcard", "Student ID card", "About 1 minute", "Take a photo of your college ID. The photo is deleted after it's checked.")}
        {option("/verify/classmates", "users", "Ask classmates", yes ? `${yes} of 2 confirmed` : "2 classmates", "Two verified students from your college confirm they know you.")}
      </div>
      <p className="note" style={{ marginTop: 14 }}><b style={{ color: "var(--ink)" }}>Why we ask:</b> Den is only for students. Verifying keeps out fake profiles, spam and Market scams. Until you verify, you can look around but not post, comment, like, message or RSVP.</p>
    </main>
  );
}
