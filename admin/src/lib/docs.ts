import fs from "node:fs";
import path from "node:path";
import { Marked, type Tokens } from "marked";

/**
 * Den's project documents (overview, technical guide, design, testing, roadmap).
 * They are Markdown files in admin/content/docs, kept in the repo next to the code,
 * so they change in the same branch as the work they describe.
 */
export type Doc = { slug: string; title: string; summary: string; body: string; updated: string };

const DIR = path.join(process.cwd(), "content", "docs");

function parse(file: string): Doc {
  const raw = fs.readFileSync(path.join(DIR, file), "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
  const meta: Record<string, string> = {};
  if (m) for (const line of m[1].split("\n")) { const i = line.indexOf(":"); if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  const body = m ? raw.slice(m[0].length) : raw;
  const updated = body.match(/Last updated ([^.*]+)/)?.[1]?.trim() || "";
  return { slug: file.replace(/^\d+-/, "").replace(/\.md$/, ""), title: meta.title || file, summary: meta.summary || "", body, updated };
}

export function listDocs(): Doc[] {
  return fs.readdirSync(DIR).filter((f) => f.endsWith(".md")).sort().map(parse);
}

export function getDoc(slug: string): Doc | null {
  return listDocs().find((d) => d.slug === slug) || null;
}

const slugify = (s: string) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/&[a-z#0-9]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Markdown to HTML. The files are ours (from the repo), not student content. Section headings get links for the contents list. */
export function renderDoc(body: string): { html: string; toc: { id: string; text: string }[] } {
  const toc: { id: string; text: string }[] = [];
  const md = new Marked({ gfm: true });
  md.use({
    renderer: {
      heading(this: { parser: { parseInline: (t: Tokens.Heading["tokens"]) => string } }, { tokens, depth, text }: Tokens.Heading) {
        const inner = this.parser.parseInline(tokens);
        if (depth === 1) return `<h1>${inner}</h1>\n`;
        const id = slugify(text);
        if (depth === 2) toc.push({ id, text: text.replace(/[*_`]/g, "") });
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
      },
    },
  });
  // Wide tables scroll sideways on phones instead of stretching the page.
  const html = (md.parse(body, { async: false }) as string).replace(/<table>/g, '<div class="doc-table"><table>').replace(/<\/table>/g, "</table></div>");
  return { html, toc };
}
