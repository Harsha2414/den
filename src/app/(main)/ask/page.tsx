"use client";
import { useGate } from "@/components/Gate";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppContext";
import Icon from "@/components/Icon";

type Turn = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "How do I prepare for placements in 6 months?",
  "Product company or mass recruiter: how should I decide?",
  "How should I plan for GATE alongside college?",
  "Review my resume plan for an internship",
];

export default function AskPage() {
  const { me } = useApp();
  const gate = useGate();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [turns.length, busy]);

  async function ask(q?: string) {
    const question = (q ?? text).trim();
    if (!question || busy) return;
    if (!gate("ask the AI senior")) return;
    const next = [...turns, { role: "user" as const, content: question }];
    setTurns(next); setText(""); setBusy(true); setErr("");
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(j.error || "Something went wrong. Try again."); setTurns(turns); setText(question); }
      else { setTurns([...next, { role: "assistant", content: j.text }]); if (typeof j.remaining === "number") setRemaining(j.remaining); }
    } catch {
      setErr("Couldn't reach the server. Check your connection."); setTurns(turns); setText(question);
    }
    setBusy(false);
  }

  return (
    <main className="wrap page">
      <section className="banner" style={{ marginTop: 16 }}>
        <h1>Ask a senior</h1>
        <p>An AI senior who knows Indian college life. Ask about exams, placements, internships, resumes or anything else, {me.name.split(" ")[0]}.</p>
      </section>

      {turns.length === 0 && (
        <div className="list" style={{ marginTop: 12 }}>
          {STARTERS.map((s) => <button key={s} className="pick" onClick={() => ask(s)}><Icon name="spark" /><div><b>{s}</b></div></button>)}
        </div>
      )}

      <div className="chat" style={{ overflow: "visible" }}>
        {turns.map((t, i) => <div key={i} className={`bub ${t.role === "user" ? "me" : ""}`}>{t.content}</div>)}
        {busy && <div className="bub">Thinking...</div>}
        <div ref={endRef} />
      </div>

      {err && <p className="warn">{err}</p>}
      <div className="inline" style={{ marginTop: 8 }}>
        <input value={text} maxLength={2000} placeholder="Ask anything about college life" aria-label="Your question"
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ask(); }} />
        <button onClick={() => ask()} disabled={busy || !text.trim()} aria-label="Ask"><Icon name="send" size={16} /></button>
      </div>
      <p className="note" style={{ marginTop: 8 }}>
        AI answers can be wrong; check important details like dates and cutoffs with official sources.
        {remaining !== null ? ` ${remaining} questions left today.` : ""}
        {turns.length > 0 && <> <button className="ghost" style={{ display: "inline", padding: 0 }} onClick={() => { setTurns([]); setErr(""); }}>Start over</button></>}
      </p>
    </main>
  );
}
