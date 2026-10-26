import Link from "next/link";
import { notFound } from "next/navigation";
import { getDoc, listDocs, renderDoc } from "@/lib/docs";
import { isAdmin } from "@/lib/server";
import PrintButton from "./PrintButton";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const d = (await isAdmin()) ? getDoc((await params).slug) : null;
  return { title: `${d?.title || "Docs"} · Den Admin` };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAdmin())) notFound();
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();
  const { html, toc } = renderDoc(doc.body);
  const all = listDocs();
  const at = all.findIndex((d) => d.slug === slug);
  const prev = all[at - 1], next = all[at + 1];
  return (
    <div className="page wide doc-page">
      <div className="doc-bar">
        <Link href="/docs">← All docs</Link>
        <PrintButton />
      </div>
      <div className="doc-grid">
        <article className="doc" dangerouslySetInnerHTML={{ __html: html }} />
        {toc.length > 2 && (
          <nav className="doc-toc" aria-label="On this page">
            <h3>On this page</h3>
            {toc.map((t) => <a key={t.id} href={`#${t.id}`}>{t.text}</a>)}
          </nav>
        )}
      </div>
      <div className="doc-next">
        {prev ? <Link href={`/docs/${prev.slug}`}>← {prev.title}</Link> : <span />}
        {next ? <Link href={`/docs/${next.slug}`}>{next.title} →</Link> : <span />}
      </div>
    </div>
  );
}
