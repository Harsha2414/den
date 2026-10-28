"use client";
import { Fragment } from "react";
import Link from "next/link";
import Linkify from "linkify-react";
import { MENTION_RE } from "@/lib/mentions";

const LINK_OPTIONS = {
  target: "_blank",
  rel: "noopener noreferrer nofollow ugc",
  className: "rt-link",
  // Long links are shortened on screen; the full address is kept.
  format: (value: string, type: string) => (type === "url" && value.length > 48 ? `${value.replace(/^https?:\/\//, "").slice(0, 45)}…` : value.replace(/^https?:\/\//, "")),
  validate: { url: (value: string) => /^(https?:\/\/|www\.)/i.test(value) || /\.[a-z]{2,}(\/|$)/i.test(value) },
};

/** Post and comment text: links open, @mentions go to the person's profile. */
export default function RichText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(MENTION_RE)) {
    const at = m.index ?? 0;
    if (at > last) parts.push(<Linkify key={`t${last}`} options={LINK_OPTIONS}>{text.slice(last, at)}</Linkify>);
    parts.push(<Link key={`m${at}`} href={`/u/${m[2]}`} className="rt-mention" onClick={(e) => e.stopPropagation()}>@{m[1]}</Link>);
    last = at + m[0].length;
  }
  if (last < text.length) parts.push(<Linkify key={`t${last}`} options={LINK_OPTIONS}>{text.slice(last)}</Linkify>);
  return <Fragment>{parts}</Fragment>;
}
