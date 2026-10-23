"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import jsQR from "jsqr";
import { supabaseBrowser } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/format";
import { extractTicketCode, timeLabel } from "@/lib/events";
import Icon from "@/components/Icon";

type Result = { kind: "ok" | "already" | "bad"; title: string; sub: string };

export default function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = supabaseBrowser();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const busyRef = useRef(false);
  const [title, setTitle] = useState("");
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [camera, setCamera] = useState<"off" | "starting" | "on" | "error">("off");
  const [camError, setCamError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [manual, setManual] = useState("");
  const [counts, setCounts] = useState<{ going: number; inside: number } | null>(null);

  const refreshCounts = useCallback(async () => {
    const { data } = await supabase.rpc("event_attendees", { ev: id });
    const rows = (data || []) as { status: string; checked_in_at: string | null }[];
    setCounts({ going: rows.filter((r) => r.status === "going").length, inside: rows.filter((r) => r.checked_in_at).length });
  }, [id, supabase]);

  useEffect(() => {
    supabase.from("events").select("title").eq("id", id).maybeSingle().then(({ data }: { data: { title: string } | null }) => setTitle(data?.title || ""));
    supabase.rpc("is_event_organiser", { ev: id }).then(({ data }: { data: unknown }) => {
      setAllowed(!!data);
      if (data) refreshCounts();
    });
  }, [id, supabase, refreshCounts]);

  const check = useCallback(async (raw: string) => {
    const code = extractTicketCode(raw);
    if (!code) { setResult({ kind: "bad", title: "Not a Den ticket", sub: "This QR code isn't a ticket for this event." }); return; }
    const now = Date.now();
    if (busyRef.current || (lastRef.current.code === code && now - lastRef.current.at < 4000)) return;
    busyRef.current = true; lastRef.current = { code, at: now };
    const { data, error } = await supabase.rpc("check_in_ticket", { ev: id, code });
    busyRef.current = false;
    if (navigator.vibrate) navigator.vibrate(error ? [80, 60, 80] : 60);
    if (error) { setResult({ kind: "bad", title: "Not valid", sub: friendlyError(error, "Couldn't check this ticket.") }); return; }
    const d = data as { already: boolean; name: string; branch: string; year: string; at: string };
    const who = [d.branch, d.year].filter(Boolean).join(", ");
    if (d.already) {
      const t = new Date(d.at);
      setResult({ kind: "already", title: `${d.name} is already in`, sub: `Checked in at ${timeLabel(`${t.getHours()}:${t.getMinutes()}`)}. ${who}` });
    } else {
      setResult({ kind: "ok", title: `Welcome, ${d.name}`, sub: who || "Checked in" });
      refreshCounts();
    }
  }, [id, supabase, refreshCounts]);

  // Camera loop
  useEffect(() => {
    if (camera !== "starting" && camera !== "on") return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let lastScan = 0;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = videoRef.current!;
        v.srcObject = stream;
        v.setAttribute("playsinline", "true");
        await v.play();
        setCamera("on");
        canvasRef.current ||= document.createElement("canvas");
        const tick = (ts: number) => {
          if (stopped) return;
          raf = requestAnimationFrame(tick);
          if (ts - lastScan < 200 || v.readyState < 2) return;
          lastScan = ts;
          const w = 480, h = Math.round((v.videoHeight / v.videoWidth) * 480) || 360;
          const c = canvasRef.current!;
          c.width = w; c.height = h;
          const ctx = c.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;
          ctx.drawImage(v, 0, 0, w, h);
          const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
          if (found?.data) check(found.data);
        };
        raf = requestAnimationFrame(tick);
      } catch (e) {
        setCamera("error");
        const name = (e as { name?: string }).name;
        setCamError(name === "NotAllowedError"
          ? "Camera permission was blocked. Allow the camera for this site in your browser settings, or type ticket codes below."
          : "Couldn't start the camera on this device. You can type ticket codes below.");
      }
    })();
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera === "off" || camera === "error", check]);

  if (allowed === false) {
    return <main className="wrap page"><div className="empty" style={{ marginTop: 20 }}>Only this event&rsquo;s organisers can scan tickets.<Link className="secondary" href={`/events/${id}`}>Back to the event</Link></div></main>;
  }

  return (
    <main className="wrap page">
      <div className="row" style={{ marginTop: 12 }}>
        <Link href={`/events/${id}`} className="ghost"><Icon name="back" size={16} /> {title || "Event"}</Link>
      </div>
      <div className="sec-head" style={{ marginTop: 8 }}>
        <h2>Scan tickets</h2>
        {counts && <small><b>{counts.inside}</b> of {counts.going} checked in</small>}
      </div>

      <div className={`scanner ${camera === "on" ? "live" : ""}`}>
        <video ref={videoRef} muted playsInline />
        {camera !== "on" && (
          <div className="scanner-cover">
            {camera === "error" ? <p>{camError}</p> : (
              <button className="primary" style={{ width: "auto", padding: "0 22px" }} disabled={camera === "starting" || allowed === null} onClick={() => setCamera("starting")}>
                <Icon name="check" /> {camera === "starting" ? "Starting camera..." : "Start scanning"}
              </button>
            )}
          </div>
        )}
        {camera === "on" && <div className="scanner-frame" aria-hidden="true" />}
      </div>

      {result && (
        <div className={`scan-result ${result.kind}`} role="status" aria-live="assertive">
          <Icon name={result.kind === "ok" ? "check" : result.kind === "already" ? "clock" : "x"} size={28} />
          <div><b>{result.title}</b><span>{result.sub}</span></div>
        </div>
      )}

      <form className="row" style={{ marginTop: 14 }} onSubmit={(e) => { e.preventDefault(); lastRef.current = { code: "", at: 0 }; check(manual); setManual(""); }}>
        <input className="code-input" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Or type the ticket code" aria-label="Ticket code" autoCapitalize="characters" maxLength={14} />
        <button className="secondary" disabled={!manual.trim()}>Check</button>
      </form>
      <p className="note" style={{ marginTop: 10 }}>Keep this screen open at the door. Each ticket works once; scanning it again shows when that person came in. Someone forgot their phone? Check them in from the guest list.</p>
    </main>
  );
}
