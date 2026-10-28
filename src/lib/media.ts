"use client";
import { supabaseBrowser } from "./supabase/client";
import { rgbaToThumbHash, thumbHashToDataURL } from "thumbhash";

/** One photo, video or file attached to something. Stored as JSON on the row. */
export interface Media {
  path: string; kind: "image" | "video" | "file"; name: string; size: number; mime: string; w?: number; h?: number;
  /** ThumbHash of a photo (about 25 bytes, base64): a blurred preview shown while it loads. */
  th?: string;
}

export type Accept = "images" | "media" | "docs" | "any";
export type Bucket = "media" | "chat";

export const MB = 1024 * 1024;
export const LIMIT = { image: 10 * MB, video: 50 * MB, file: 20 * MB };

const DOC_EXT = ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "csv", "zip"];
const DOC_MIME: Record<string, string> = {
  pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain", csv: "text/csv", zip: "application/zip",
};
const VIDEO_MIME: Record<string, string> = { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm" };

export const ACCEPT_ATTR: Record<Accept, string> = {
  images: "image/*",
  media: "image/*,video/mp4,video/quicktime,video/webm",
  docs: DOC_EXT.map((e) => "." + e).join(","),
  any: "image/*,video/mp4,video/quicktime,video/webm," + DOC_EXT.map((e) => "." + e).join(","),
};

const ext = (name: string) => (name.split(".").pop() || "").toLowerCase();

export function kindOf(f: File): Media["kind"] | null {
  const e = ext(f.name);
  if (f.type.startsWith("image/") && f.type !== "image/svg+xml") return "image";
  if (f.type.startsWith("video/") || VIDEO_MIME[e]) return "video";
  if (DOC_EXT.includes(e)) return "file";
  return null;
}

export function allowed(kind: Media["kind"], accept: Accept) {
  if (accept === "images") return kind === "image";
  if (accept === "media") return kind !== "file";
  if (accept === "docs") return kind === "file";
  return true;
}

export const sizeLabel = (n: number) => (n >= MB ? `${(n / MB).toFixed(n >= 10 * MB ? 0 : 1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Photos are shrunk to at most 2048 px (sharp on phones, ~5x smaller). GIFs are kept as they are. */
async function prepareImage(f: File): Promise<{ blob: Blob; mime: string; ext: string; w?: number; h?: number; th?: string }> {
  if (f.type === "image/gif") return { blob: f, mime: "image/gif", ext: "gif" };
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const scale = Math.min(1, 2048 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error("encode"))), "image/jpeg", 0.85));
    return { blob, mime: "image/jpeg", ext: "jpg", w, h, th: thumbHashOf(img) };
  } finally { URL.revokeObjectURL(url); }
}

/** A tiny blurred preview of the photo (ThumbHash needs at most 100 x 100 pixels). */
function thumbHashOf(img: HTMLImageElement): string | undefined {
  try {
    const s = Math.min(1, 100 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0, w, h);
    const hash = rgbaToThumbHash(w, h, ctx.getImageData(0, 0, w, h).data);
    return btoa(String.fromCharCode(...hash));
  } catch { return undefined; }
}

/** A data URL of the blurred preview, for showing while the real photo loads. */
export function thumbHashUrl(th: string | undefined): string | undefined {
  if (!th) return undefined;
  try { return thumbHashToDataURL(Uint8Array.from(atob(th), (ch) => ch.charCodeAt(0))); } catch { return undefined; }
}

/** Upload one file. folder is "<my id>" for media, "<my id>/<conversation id>" for chat. */
export async function upload(f: File, bucket: Bucket, folder: string): Promise<Media> {
  const kind = kindOf(f);
  if (!kind) throw new Error(`${f.name}: this type of file isn't supported.`);
  let blob: Blob = f, mime = f.type, e = ext(f.name), w: number | undefined, h: number | undefined, th: string | undefined;
  if (kind === "image") ({ blob, mime, ext: e, w, h, th } = await prepareImage(f));
  if (kind === "video") mime = VIDEO_MIME[e] || f.type || "video/mp4";
  if (kind === "file") mime = DOC_MIME[e] || f.type;
  const limit = LIMIT[kind];
  if (blob.size > limit) throw new Error(`${f.name} is ${sizeLabel(blob.size)}. The limit for ${kind === "file" ? "files" : kind + "s"} is ${sizeLabel(limit)}.`);
  const path = `${folder}/${crypto.randomUUID()}.${e || "bin"}`;
  const { error } = await supabaseBrowser().storage.from(bucket).upload(path, blob, { contentType: mime, upsert: false, cacheControl: "31536000" });
  if (error) throw new Error(/row-level|policy|403/i.test(error.message) ? "Only verified students can upload." : `Couldn't upload ${f.name}. Try again.`);
  return { path, kind, name: f.name.slice(0, 200), size: blob.size, mime, ...(w ? { w, h } : {}), ...(th ? { th } : {}) };
}

export const publicUrl = (path: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${path}`;
export const PUBLIC_PREFIX = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`;

/** Private chat files need short-lived links. Cached for the session. */
const signed = new Map<string, { url: string; exp: number }>();
export async function chatUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const need = paths.filter((p) => !signed.has(p) || signed.get(p)!.exp < now + 60e3);
  if (need.length) {
    const { data } = await supabaseBrowser().storage.from("chat").createSignedUrls(need, 3600);
    (data || []).forEach((d: { path: string | null; signedUrl: string }) => { if (d.path && d.signedUrl) signed.set(d.path, { url: d.signedUrl, exp: now + 3600e3 }); });
  }
  return Object.fromEntries(paths.filter((p) => signed.has(p)).map((p) => [p, signed.get(p)!.url]));
}

export function parseMedia(v: unknown): Media[] {
  if (Array.isArray(v)) return v as Media[];
  if (typeof v === "string" && v) { try { const j = JSON.parse(v); return Array.isArray(j) ? j : []; } catch { return []; } }
  return [];
}
