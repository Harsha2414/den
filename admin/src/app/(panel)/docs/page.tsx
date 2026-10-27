import Link from "next/link";
import { notFound } from "next/navigation";
import { listDocs } from "@/lib/docs";
import { isAdmin } from "@/lib/server";

export const metadata = { title: "Docs · Den Admin" };

export default async function DocsPage() {
  if (!(await isAdmin())) notFound();
  const docs = listDocs();
  return (
    <div className="page">
      <h1>Docs</h1>
      <p className="muted doc-lead">Everything about Den in one place: what it is and how we got here, how it&rsquo;s built, how it looks, how it&rsquo;s tested, and what comes next.</p>
      <div className="doc-list">
        {docs.map((d, i) => (
          <Link key={d.slug} href={`/docs/${d.slug}`} className="doc-item">
            <span className="doc-num">{String(i + 1).padStart(2, "0")}</span>
            <span className="doc-text">
              <b>{d.title}</b>
              <span>{d.summary}</span>
              {d.updated && <small>Updated {d.updated}</small>}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
