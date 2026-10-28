"use client";
import { useEffect, useRef, useState } from "react";
import { ACCEPT_ATTR, allowed, chatUrls, kindOf, publicUrl, sizeLabel, thumbHashUrl, upload, type Accept, type Bucket, type Media } from "@/lib/media";
import { useDataSaver } from "@/lib/dataSaver";
import YarlLightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
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

/** Show attached photos (grid; tap for a full-screen viewer with pinch-zoom and swipe), videos and files.
 *  onDoubleTap: posts use it for "double-tap to like" (a single tap still opens the viewer). */
export function MediaView({ items, bucket = "media", className = "", onDoubleTap, alwaysLoad }: {
  items: Media[]; bucket?: Bucket; className?: string; onDoubleTap?: () => void;
  /** Show photos even with data saver on (the post's own page). */
  alwaysLoad?: boolean;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<number | null>(null);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [burst, setBurst] = useState(0);
  const saver = useDataSaver();
  const [tapped, setTapped] = useState(false);
  const lastTap = useRef(0);
  const single = useRef<number | null>(null);
  useEffect(() => {
    if (!items.length) return;
    if (bucket === "media") setUrls(Object.fromEntries(items.map((m) => [m.path, publicUrl(m.path)])));
    else chatUrls(items.map((m) => m.path)).then(setUrls);
  }, [items, bucket]);
  useEffect(() => () => { if (single.current) window.clearTimeout(single.current); }, []);
  if (!items.length) return null;
  const imgs = items.filter((m) => m.kind === "image");
  const vids = items.filter((m) => m.kind === "video");
  const files = items.filter((m) => m.kind === "file");
  const hold = saver && !alwaysLoad && !tapped && bucket === "media";
  const photoBytes = imgs.reduce((n, m) => n + (m.size || 0), 0);

  function tap(i: number) {
    if (!onDoubleTap) return setOpen(i);
    const now = Date.now();
    if (now - lastTap.current < 280) {
      if (single.current) { window.clearTimeout(single.current); single.current = null; }
      lastTap.current = 0;
      setBurst((b) => b + 1);
      onDoubleTap();
      return;
    }
    lastTap.current = now;
    single.current = window.setTimeout(() => { single.current = null; setOpen(i); }, 280);
  }

  return (
    <div className={`mview ${className}`}>
      {imgs.length > 0 && (hold ? (
        <button type="button" className="msaver" onClick={(e) => { e.stopPropagation(); setTapped(true); }}
          style={thumbHashUrl(imgs[0].th) ? { backgroundImage: `url(${thumbHashUrl(imgs[0].th)})` } : undefined}>
          <span><Icon name="image" size={18} /> Tap to load {imgs.length === 1 ? "photo" : `${imgs.length} photos`}{photoBytes ? ` (${sizeLabel(photoBytes)})` : ""}</span>
        </button>
      ) : (
        <div className={`mgrid n${Math.min(imgs.length, 4)}`}>
          {imgs.slice(0, 4).map((m, i) => {
            const ph = thumbHashUrl(m.th);
            return (
              <button key={m.path} type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); tap(i); }} aria-label={`Open photo ${i + 1}`}
                style={ph && !loaded[m.path] ? { backgroundImage: `url(${ph})`, backgroundSize: "cover" } : undefined}>
                {urls[m.path] ? <img src={urls[m.path]} alt="" loading="lazy" width={m.w} height={m.h} className={ph ? (loaded[m.path] ? "in" : "fade") : ""}
                  onLoad={() => setLoaded((l) => ({ ...l, [m.path]: true }))} /> : <span className="sk" />}
                {i === 3 && imgs.length > 4 && <em>+{imgs.length - 4}</em>}
              </button>
            );
          })}
          {burst > 0 && <span key={burst} className="heart-burst" aria-hidden="true"><Icon name="heart" size={84} fill /></span>}
        </div>
      ))}
      {vids.map((m) => urls[m.path]
        ? <video key={m.path} src={urls[m.path]} controls playsInline preload={saver && !alwaysLoad ? "none" : "metadata"} onClick={(e) => e.stopPropagation()} />
        : <span key={m.path} className="sk" style={{ height: 180 }} />)}
      {files.map((m) => (
        <a key={m.path} className="mfile" href={urls[m.path] ? `${urls[m.path]}${urls[m.path].includes("?") ? "&" : "?"}download=${encodeURIComponent(m.name)}` : undefined}
          target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
          <span className="mthumb-file" style={{ background: FILE_COLORS[extOf(m.name)] || "#566274" }}>{extOf(m.name).toUpperCase() || "FILE"}</span>
          <span><b>{m.name}</b><small>{sizeLabel(m.size)} · Tap to open</small></span>
          <Icon name="download" size={18} />
        </a>
      ))}
      {open !== null && (
        <YarlLightbox open close={() => setOpen(null)} index={open} plugins={imgs.length > 1 ? [Zoom, Counter] : [Zoom]}
          slides={imgs.map((m) => ({ src: urls[m.path], width: m.w, height: m.h }))}
          carousel={{ finite: true }} zoom={{ maxZoomPixelRatio: 3, scrollToZoom: true }}
          controller={{ closeOnBackdropClick: true, closeOnPullDown: true }}
          render={imgs.length > 1 ? undefined : { buttonPrev: () => null, buttonNext: () => null }} />
      )}
    </div>
  );
}
