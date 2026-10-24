import { Fragment, type ReactNode } from "react";

/**
 * A small, safe formatter for articles. Supports:
 *   ## Heading, ### Small heading, > quote, - bullet, 1. numbered, --- divider,
 *   **bold**, *italic*, `code`, [text](https://link)
 *   ![caption](photo link) and !video[caption](video link) on their own line, only for files uploaded to Den
 * It builds React elements directly, so no HTML from the writer ever reaches the page.
 */
const OWN = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`;
const MEDIA_LINE = /^(!video|!)\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/;

const INLINE = /(\*\*([^*]+)\*\*)|(\*([^*\s][^*]*)\*)|(`([^`]+)`)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  let i = 0;
  while ((m = INLINE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[2]) out.push(<strong key={k}>{m[2]}</strong>);
    else if (m[4]) out.push(<em key={k}>{m[4]}</em>);
    else if (m[6]) out.push(<code key={k}>{m[6]}</code>);
    else if (m[8]) out.push(<a key={k} href={m[9]} target="_blank" rel="noopener noreferrer nofollow ugc">{m[8]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function lines(ls: string[], key: string) {
  return ls.map((l, i) => <Fragment key={i}>{i > 0 && <br />}{inline(l, `${key}-${i}`)}</Fragment>);
}

export function Markdown({ text }: { text: string }) {
  const src = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let b = 0;
  while (i < src.length) {
    const line = src[i];
    const t = line.trim();
    const key = `b${b++}`;
    if (!t) { i++; continue; }
    if (/^---+$/.test(t)) { blocks.push(<hr key={key} />); i++; continue; }
    const mm = t.match(MEDIA_LINE);
    if (mm && mm[3].startsWith(OWN())) {
      blocks.push(
        <figure key={key}>
          {mm[1] === "!video" ? <video src={mm[3]} controls playsInline preload="metadata" /> : <img src={mm[3]} alt={mm[2]} loading="lazy" />}
          {mm[2] && mm[1] !== "!video" && <figcaption>{mm[2]}</figcaption>}
        </figure>,
      );
      i++; continue;
    }
    const h = t.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      blocks.push(h[1].length <= 2 ? <h2 key={key}>{inline(h[2], key)}</h2> : <h3 key={key}>{inline(h[2], key)}</h3>);
      i++; continue;
    }
    if (t.startsWith(">")) {
      const q: string[] = [];
      while (i < src.length && src[i].trim().startsWith(">")) { q.push(src[i].trim().replace(/^>\s?/, "")); i++; }
      blocks.push(<blockquote key={key}>{lines(q, key)}</blockquote>);
      continue;
    }
    if (/^[-*]\s+/.test(t)) {
      const items: string[] = [];
      while (i < src.length && /^[-*]\s+/.test(src[i].trim())) { items.push(src[i].trim().replace(/^[-*]\s+/, "")); i++; }
      blocks.push(<ul key={key}>{items.map((x, j) => <li key={j}>{inline(x, `${key}-${j}`)}</li>)}</ul>);
      continue;
    }
    if (/^\d+[.)]\s+/.test(t)) {
      const items: string[] = [];
      while (i < src.length && /^\d+[.)]\s+/.test(src[i].trim())) { items.push(src[i].trim().replace(/^\d+[.)]\s+/, "")); i++; }
      blocks.push(<ol key={key}>{items.map((x, j) => <li key={j}>{inline(x, `${key}-${j}`)}</li>)}</ol>);
      continue;
    }
    const para: string[] = [];
    while (i < src.length && src[i].trim() && !/^(#{1,3}\s|>|[-*]\s|\d+[.)]\s|---+$|!video\[|!\[)/.test(src[i].trim())) { para.push(src[i].trim()); i++; }
    if (!para.length) { para.push(t); i++; }
    blocks.push(<p key={key}>{lines(para, key)}</p>);
  }
  return <div className="prose">{blocks}</div>;
}

/** Plain text for previews: drops the formatting marks. */
export function plainText(md: string): string {
  return md
    .replace(/!(video)?\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*`>#_]|^\s*[-]\s+|^\s*\d+[.)]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const readMinutes = (md: string) => Math.max(1, Math.round(plainText(md).split(" ").filter(Boolean).length / 200));
