"use client";
import { useEffect, useRef, useState } from "react";
import { ACCEPT_ATTR, allowed, chatUrls, kindOf, publicUrl, sizeLabel, upload, type Accept, type Bucket, type Media } from "@/lib/media";
import { useApp } from "./AppContext";
import Icon from "./Icon";

const FILE_COLORS: Record<string, string> = { pdf: "#C9485F", doc: "#2B6CB0", docx: "#2B6CB0", ppt: "#D9692E", pptx: "#D9692E", xls: "#2F8F5B", xlsx: "#2F8F5B", zip: "#566274" };
const extOf = (n: string) => (n.split(".").pop() || "").toLowerCase();

/** Pick and upload photos, videos or files. Each one uploads as soon as it's chosen. */
export function MediaPicker({ value, onChange, accept = "images", max = 4, bucket = "media", folder, label, onBusy, compact }: {
  value: Media[]; onChange: (m: Media[]) => void; accept?: Accept; max?: number; bucket?: Bucket; folder?: string;
  label?: string; onBusy?: (busy: boolean) => void; compact?: boolean;
}) {
  const { me } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => { onBusy?.(pending.length > 0); }, [pending.length, onBusy]);

  async function pick(files: FileList | null) {
    setErr("");
    if (!files?.length) return;
    const room = max - latest.current.length - pending.length;
    const list = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > room) setErr(room <= 0 ? `You can add up to ${max}.` : `Only the first ${room} were added (limit ${max}).`);
    for (const f of list) {
      const k = kindOf(f);
      if (!k || !allowed(k, accept)) { setErr(`${f.name}: that type of file can't be added here.`); continue; }
      const tag = `${f.name}-${Math.random()}`;
      setPending((p) => [...p, tag]);
      try {
        const m = await upload(f, bucket, folder || me.id);
        onChange([...latest.current, m]);
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setPending((p) => p.filter((x) => x !== tag));
      }
    }
    if (input.current) input.current.value = "";
  }

  const remove = (path: string) => onChange(value.filter((m) => m.path !== path));
  const full = value.length + pending.length >= max;
  const word = accept === "images" ? (max === 1 ? "photo" : "photos") : accept === "docs" ? "file" : "photo, video or file";

  return (
    <div className={`mpick ${compact ? "compact" : ""}`}>
      {label && <div className="mpick-label">{label}</div>}
      <div className="mpick-row">
        {value.map((m) => (
          <div key={m.path} className={`mthumb ${m.kind}`}>
            {m.kind === "image" && bucket === "media" ? <img src={publicUrl(m.path)} alt="" /> :
              m.kind === "video" ? <span className="mthumb-ico"><Icon name="play" size={22} /></span> :
              m.kind === "image" ? <span className="mthumb-ico"><Icon name="image" size={22} /></span> :
              <span className="mthumb-file" style={{ background: FILE_COLORS[extOf(m.name)] || "#566274" }}>{extOf(m.name).toUpperCase() || "FILE"}</span>}
            {m.kind !== "image" && <small>{m.name}</small>}
            <button type="button" className="mthumb-x" onClick={() => remove(m.path)} aria-label={`Remove ${m.name}`}><Icon name="x" size={14} /></button>
          </div>
        ))}
        {pending.map((p) => <div key={p} className="mthumb loading" aria-label="Uploading"><span className="spinner" /></div>)}
        {!full && (
          <button type="button" className="madd" onClick={() => input.current?.click()}>
            <Icon name={accept === "docs" ? "file" : "image"} size={22} /><span>Add {word}</span>
          </button>
        )}
      </div>
      <input ref={input} type="file" hidden multiple={max > 1} accept={ACCEPT_ATTR[accept]} onChange={(e) => pick(e.target.files)} />
      {err && <p className="err" role="alert" style={{ marginTop: 6 }}>{err}</p>}
      {!compact && <small className="mpick-hint">{accept === "images" ? "Photos are resized automatically." : accept === "docs" ? "PDF, Word, PowerPoint, Excel or ZIP, up to 20 MB." : "Photos, videos up to 50 MB, files up to 20 MB."}</small>}
    </div>
  );
}

/** Show attached photos (grid with full-screen view), videos and files. */
export function MediaView({ items, bucket = "media", className = "" }: { items: Media[]; bucket?: Bucket; className?: string }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (!items.length) return;
    if (bucket === "media") setUrls(Object.fromEntries(items.map((m) => [m.path, publicUrl(m.path)])));
    else chatUrls(items.map((m) => m.path)).then(setUrls);
  }, [items, bucket]);
  if (!items.length) return null;
  const imgs = items.filter((m) => m.kind === "image");
  const vids = items.filter((m) => m.kind === "video");
  const files = items.filter((m) => m.kind === "file");
  return (
    <div className={`mview ${className}`}>
      {imgs.length > 0 && (
        <div className={`mgrid n${Math.min(imgs.length, 4)}`}>
          {imgs.slice(0, 4).map((m, i) => (
            <button key={m.path} type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(i); }} aria-label={`Open photo ${i + 1}`}>
              {urls[m.path] ? <img src={urls[m.path]} alt="" loading="lazy" width={m.w} height={m.h} /> : <span className="sk" />}
              {i === 3 && imgs.length > 4 && <em>+{imgs.length - 4}</em>}
            </button>
          ))}
        </div>
      )}
      {vids.map((m) => urls[m.path]
        ? <video key={m.path} src={urls[m.path]} controls playsInline preload="metadata" onClick={(e) => e.stopPropagation()} />
        : <span key={m.path} className="sk" style={{ height: 180 }} />)}
      {files.map((m) => (
        <a key={m.path} className="mfile" href={urls[m.path] ? `${urls[m.path]}${urls[m.path].includes("?") ? "&" : "?"}download=${encodeURIComponent(m.name)}` : undefined}
          target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
          <span className="mthumb-file" style={{ background: FILE_COLORS[extOf(m.name)] || "#566274" }}>{extOf(m.name).toUpperCase() || "FILE"}</span>
          <span><b>{m.name}</b><small>{sizeLabel(m.size)} · Tap to open</small></span>
          <Icon name="download" size={18} />
        </a>
      ))}
      {open !== null && <Lightbox items={imgs} urls={urls} start={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Lightbox({ items, urls, start, onClose }: { items: Media[]; urls: Record<string, string>; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => Math.min(items.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [items.length, onClose]);
  const m = items[i];
  return (
    <div className="lightbox" onClick={(e) => { e.stopPropagation(); onClose(); }} role="dialog" aria-modal="true" aria-label="Photo">
      <img src={urls[m.path]} alt="" onClick={(e) => e.stopPropagation()} />
      <button className="lb-x" aria-label="Close" onClick={onClose}><Icon name="x" size={22} /></button>
      {items.length > 1 && <>
        <button className="lb-prev" aria-label="Previous" disabled={i === 0} onClick={(e) => { e.stopPropagation(); setI(i - 1); }}><Icon name="back" size={24} /></button>
        <button className="lb-next" aria-label="Next" disabled={i === items.length - 1} onClick={(e) => { e.stopPropagation(); setI(i + 1); }}><Icon name="chevRight" size={24} /></button>
        <span className="lb-count">{i + 1} / {items.length}</span>
      </>}
    </div>
  );
}
