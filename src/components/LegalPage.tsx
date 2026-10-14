import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL } from "@/lib/legal";

const DOCS = [
  { href: "/terms", label: "Terms of use" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/guidelines", label: "Community guidelines" },
];

export default function LegalPage({ title, current, children }: { title: string; current: string; children: ReactNode }) {
  return (
    <main className="legal">
      <header className="legal-top">
        <Link href="/" className="brand" aria-label="Den home">Den<span>.</span></Link>
      </header>
      <nav className="legal-nav" aria-label="Policies">
        {DOCS.map((d) => (
          <Link key={d.href} href={d.href} className={`pill ${d.href === current ? "on" : ""}`} aria-current={d.href === current ? "page" : undefined}>
            {d.label}
          </Link>
        ))}
      </nav>
      <h1>{title}</h1>
      <p className="legal-date">Effective {LEGAL.effectiveDate}</p>
      <article className="legal-body">{children}</article>
      <footer className="legal-foot">
        <p>Questions or complaints? Write to <b>{LEGAL.grievanceEmail}</b>.</p>
        <Link href="/" className="secondary">Back to Den</Link>
      </footer>
    </main>
  );
}

export function Grievance() {
  return (
    <>
      <p>
        If you have a complaint about content on Den, how your data is handled, or a decision we made about your account,
        contact our Grievance Officer:
      </p>
      <ul>
        <li><b>Name:</b> {LEGAL.grievanceOfficer}</li>
        <li><b>Email:</b> {LEGAL.grievanceEmail}</li>
        <li><b>Address:</b> {LEGAL.operator}, {LEGAL.city}</li>
      </ul>
      <p>
        We acknowledge complaints within 24 hours and aim to resolve them within 15 days. Complaints about content that shows
        a person in a sexual or intimate way without their consent, or impersonates someone, are acted on within 24 hours.
      </p>
    </>
  );
}
