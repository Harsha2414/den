"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { applyTheme } from "./ThemeToggle";
import PolicyLinks from "./PolicyLinks";
import CollegeSearch, { type CollegeHit } from "./CollegeSearch";
import { EDITION_COOKIE, readEditionCookie, writeEditionCookie, type Edition } from "@/lib/edition";
import "./landing.css";

export type EditionCollege = CollegeHit;

const LANGS: { id: string; label: string; head: string }[] = [
  { id: "en", label: "English", head: "" },
  { id: "hi", label: "हिंदी", head: "भारत के हर कैंपस को अब मिला अपना घर।" },
  { id: "ta", label: "தமிழ்", head: "இந்தியாவின் ஒவ்வொரு கல்லூரிக்கும் இப்போது சொந்த வீடு." },
  { id: "te", label: "తెలుగు", head: "భారతదేశంలోని ప్రతి క్యాంపస్‌కు ఇప్పుడు సొంత ఇల్లు." },
  { id: "kn", label: "ಕನ್ನಡ", head: "ಭಾರತದ ಪ್ರತಿಯೊಂದು ಕ್ಯಾಂಪಸ್‌ಗೂ ಈಗ ತನ್ನದೇ ಮನೆ." },
  { id: "bn", label: "বাংলা", head: "ভারতের প্রতিটি ক্যাম্পাসের এখন নিজের ঘর।" },
  { id: "mr", label: "मराठी", head: "भारतातील प्रत्येक कॅम्पसला आता स्वतःचं घर." },
];

const EXAM = [
  { q: "Where are your PYQs right now?", options: ["a WhatsApp group from 2019", "a senior’s pen drive", "lost forever", "on Den, sorted by subject"], right: "correct!", wrong: "hint: try (d)" },
  { q: "How do you find out about the fest?", options: ["a poster, after it ended", "14 forwarded messages", "a friend’s friend’s story", "Den events, with a QR pass"], right: "well done", wrong: "think again" },
  { q: "Before placements, you ask…", options: ["Google, nervously", "nobody", "the senior who never replies", "placement stories on Den"], right: "excellent!", wrong: "see me after class" },
];
const RIGHT = 3;

const SCOPE: Record<string, string> = {
  CSE: "A senior will share exactly the PYQ you need, at 2 am. Lucky number: 404.",
  ECE: "Your circuit works on the first try. Just kidding. The lab notes on Den will help.",
  Mechanical: "Your old drafter sells on the Market by noon. Spend it on chai.",
  Civil: "A survey camp friendship becomes campus legend. Post the photos.",
  Commerce: "Your balance sheet will balance. Your sleep schedule will not.",
  Arts: "Your article gets more reads than the topper’s notes. Write it tonight.",
  Medical: "You will remember every bone, and where you kept the anatomy notes: Den.",
  Law: "You win tonight’s debate Space. The other side demands a re-vote.",
};

// FEST across, TEA down from the T, VIVA across.
const GRID = ["FEST#", "###E#", "VIVA#"];
const NUMS: Record<string, number> = { "0,0": 1, "0,3": 2, "2,0": 3 };

const LAUNCH = Date.UTC(2026, 10, 3);
function todayInIndia() {
  const d = new Date();
  const label = d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const ist = new Date(d.getTime() + 5.5 * 3600_000);
  const day = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  return { label, issue: Math.max(1, Math.floor((day - LAUNCH) / 86400_000) + 1) };
}

/** A pen stroke that draws itself when it scrolls into view. */
function Pen({ d, viewBox, className, width = 3 }: { d: string[]; viewBox: string; className?: string; width?: number }) {
  return (
    <svg className={`pen ${className || ""}`} viewBox={viewBox} preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((p, i) => <path key={i} d={p} pathLength={1000} style={{ transitionDelay: `${i * 0.5}s` }} />)}
    </svg>
  );
}

export default function Landing({ colleges }: { colleges: EditionCollege[] }) {
  const [today, setToday] = useState(() => todayInIndia());
  const [lang, setLang] = useState("en");
  const [night, setNight] = useState<boolean | null>(null);
  const [edition, setEdition] = useState<Edition | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [branch, setBranch] = useState("CSE");
  const [reveal, setReveal] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const heroCta = useRef<HTMLDivElement>(null);
  const finalCta = useRef<HTMLElement>(null);

  useEffect(() => {
    setToday(todayInIndia());
    const t = document.documentElement.dataset.theme;
    setNight(t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches);
    // Bring back a college picked on an earlier visit.
    const m = document.cookie.match(new RegExp(`${EDITION_COOKIE}=([^;]+)`));
    const saved = readEditionCookie(m?.[1]);
    if (saved) setEdition(saved);
  }, []);

  // Pen marks draw as they scroll into view.
  useEffect(() => {
    const el = root.current; if (!el) return;
    const pens = el.querySelectorAll(".pen");
    if (!("IntersectionObserver" in window)) { pens.forEach((p) => p.classList.add("drawn")); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("drawn"); io.unobserve(e.target); } }), { threshold: 0.6 });
    pens.forEach((p) => io.observe(p));
    return () => io.disconnect();
  }, []);

  // The Join bar on phones: shows once the first Join button has scrolled away, hides at the last one.
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    let heroGone = false, finalSeen = false;
    const update = () => setShowBar(heroGone && !finalSeen);
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.target === heroCta.current) heroGone = !e.isIntersecting && e.boundingClientRect.top < 0;
      if (e.target === finalCta.current) finalSeen = e.isIntersecting;
      update();
    }));
    if (heroCta.current) io.observe(heroCta.current);
    if (finalCta.current) io.observe(finalCta.current);
    return () => io.disconnect();
  }, []);

  function pickEdition(c: Edition | null) {
    const e = c ? { id: c.id, name: c.name } : null;
    setEdition(e);
    try { writeEditionCookie(e); } catch { /* cookies blocked: the page still works */ }
  }
  function toggleNight() { const next = !night; applyTheme(next ? "dark" : "light"); setNight(next); }

  const cur = LANGS.find((l) => l.id === lang) || LANGS[0];
  const ed = edition?.name;
  const editionLabel = ed ? `${ed} edition` : "All India edition";
  const joinLabel = ed ? `Join ${ed} on Den` : "Join your college";
  const correct = EXAM.filter((_, i) => answers[i] === RIGHT).length;
  const passed = correct === EXAM.length;
  const answered = Object.keys(answers).length;

  return (
    <div className="np" ref={root}>
      <div className="np-fold" aria-hidden="true" />
      <div className="np-wrap">
        <div className="np-strip">
          <span suppressHydrationWarning>{today.label} · No. {today.issue} · {editionLabel}</span>
          <span className="np-strip-acts">
            <span className="np-langs" role="group" aria-label="Read the headline in">
              {LANGS.map((l) => (
                <button key={l.id} type="button" lang={l.id} aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>{l.label}</button>
              ))}
            </span>
            <button type="button" className="np-night" onClick={toggleNight} aria-pressed={night === true}>
              {night ? "☀ Day edition" : "☾ Night edition"}
            </button>
          </span>
        </div>

        <header className="np-mast">
          <span className="np-chai" aria-hidden="true" />
          <Link href="/" className="np-logo" aria-label="Den home">Den<span>.</span></Link>
          <p className="np-tag">The student hangout for every college in India</p>
          <div className="np-scrib np-scrib-mast hand" aria-hidden="true">
            read this<br />before exams!!
            <Pen viewBox="0 0 70 40" d={["M64 4C46 8 30 20 10 32", "M10 22v10h11"]} width={2.4} />
          </div>
          <Link href="/login" className="np-signin">Sign in</Link>
        </header>

        <EditionPicker colleges={colleges} value={edition} onPick={pickEdition} />

        <nav className="np-nav" aria-label="Sections">
          <a href="#exam">Today’s paper</a>
          <a href="#sports">Debates</a>
          <a href="#scope">Exam-o-scope</a>
          <a href="#funnies">Funnies</a>
          <a href="#viva">Viva</a>
          <Link href="/login" className="np-nav-join">Sign in →</Link>
        </nav>

        {/* Front page */}
        <section className="np-front">
          <div className="np-lead">
            <div className="np-kicker">Front page · {editionLabel}</div>
            {lang === "en" ? (
              <h1 className="np-head">
                {ed ? <>{ed} now has </> : <>Every campus in India now has </>}
                <span className="np-circle">a home<Pen viewBox="0 0 300 100" d={["M150 6C60 4 6 22 8 52s70 44 150 42 136-18 134-46S220 2 120 10"]} /></span> of its own.
              </h1>
            ) : (
              <>
                <h1 className="np-head np-head-tr" lang={cur.id}>{cur.head}</h1>
                <p className="np-head-en">Every campus in India now has a home of its own.</p>
              </>
            )}
            <p className="np-deck">
              Notes and PYQs from your seniors, honest{" "}
              <span className="np-under">placement stories<Pen viewBox="0 0 200 12" d={["M2 8c40-6 90-6 196-2"]} /></span>,
              fest passes, live voice rooms and a feed shared by students across the country.
            </p>
            <div className="np-ctas" ref={heroCta}>
              <Link href="/login" className="np-btn np-btn-ink">{joinLabel}</Link>
              <a href="#exam" className="np-btn np-btn-line">Take today’s paper</a>
              <span className="hand np-cta-note">← free, students only</span>
            </div>

            <figure className="np-figure">
              <div className="np-phone" aria-hidden="true">
                <div className="np-phone-screen">
                  <div className="np-ph-bar"><b>Den<span>.</span></b><i>{ed || "Your college"}</i></div>
                  <div className="np-ph-tabs"><span className="on">For you</span><span>Notes</span><span>Placements</span><span>Market</span></div>
                  <div className="np-ph-story"><small>Notes · 3rd year CSE</small><b>DBMS mid-sem PYQs, 2021 to 2025, with solutions</b><em>Shared by a senior</em></div>
                  <div className="np-ph-story"><small>Placements</small><b>Three rounds and a case study: my analyst interview</b><em>Final year · 6 min read</em></div>
                  <div className="np-ph-event"><span><b>14</b>NOV</span><div><b>Hackathon night</b><em>Main auditorium · pass available</em></div></div>
                </div>
              </div>
              <div className="np-figure-side">
                <figcaption>Your college in one feed. The whole country one tap away. Switch between <b>Your college</b> and <b>All India</b> any time.</figcaption>
                <div className="hand np-scrib-fig" aria-hidden="true">this is Den ☺<br />works on any phone</div>
              </div>
            </figure>
          </div>

          <aside className="np-aside">
            <div className="np-box">
              <div className="np-kicker">Campus forecast</div>
              <div className="np-forecast">
                <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 15a4 4 0 1 1 .8-7.9A5 5 0 0 1 17 9a3 3 0 0 1 0 6z" /><path d="M8 18l-1 2" /><path d="M12 18l-1 2" /><path d="M16 18l-1 2" /></svg>
                <div><b>Heavy PYQ showers</b><span>expected before mid-sems</span></div>
              </div>
              <div className="np-days"><div><b>Mon</b>Viva fog</div><div><b>Wed</b>Assignment storm</div><div><b>Fri</b>Fest sunshine</div></div>
            </div>

            <div className="np-kicker np-issue-head">In this issue</div>
            <ol className="np-issue">
              {[["Notes and PYQs", "Five years of papers, by course."], ["Placement season", "Every round, told by those who sat it."], ["Fest passes", "RSVP in a tap, QR ticket at the gate."], ["Live debates", "Two sides, a timer, the campus votes."]].map(([t, s], i) => (
                <li key={t}><span className="np-num">0{i + 1}</span><span><b>{t}</b><small>{s}</small></span><span className="hand np-tick" aria-hidden="true">✓</span></li>
              ))}
            </ol>

            <div className="np-box np-notice">
              <div className="hand np-important" aria-hidden="true">important!</div>
              <h2>Notice to readers</h2>
              <p>Only verified students can post, comment or message. Anyone can look around first.</p>
              <ul>
                <li><b>College email?</b> Sign in with it and you get the blue tick straight away.</li>
                <li><b>No college email?</b> Sign in with Google, then verify once with your student ID card or two verified classmates.</li>
              </ul>
            </div>
          </aside>
        </section>

        {/* The mini exam */}
        <section id="exam" className="np-sec">
          <div className="np-sec-head"><h2>Today’s question paper</h2><span>Tap your answers. The teacher is watching.</span></div>
          <div className="np-pencil" aria-hidden="true"><i /><i /><i /><i /></div>
          <div className="np-sheet">
            <div className="np-sheet-top"><span><b>CAMPUS LIFE 101</b> <em>· Paper code DEN-001</em></span><span>Time: <b>1 minute</b> · Max marks: <b>100</b></span></div>
            {EXAM.map((q, qi) => {
              const pick = answers[qi];
              const done = pick !== undefined;
              const ok = pick === RIGHT;
              return (
                <fieldset key={qi} className="np-q">
                  <legend><span className="np-qno">Q{qi + 1}.</span> {q.q}</legend>
                  <div className="np-opts">
                    {q.options.map((o, oi) => (
                      <button key={oi} type="button" aria-pressed={pick === oi}
                        className={`hand np-opt ${pick === oi ? (ok ? "is-right" : "is-wrong") : ""}`}
                        onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}>
                        ({"abcd"[oi]}) {o}
                      </button>
                    ))}
                  </div>
                  {done && <div className="hand np-mark" aria-live="polite"><b>{ok ? "✓" : "✗"}</b>{ok ? q.right : q.wrong}</div>}
                </fieldset>
              );
            })}
            <div className="np-result">
              {passed ? (
                <>
                  <div className="np-stamp np-stamp-in"><b>PASSED</b><span>TOTAL 100 / 100</span></div>
                  <Link href="/login" className="np-btn np-btn-red">Collect your result: join Den</Link>
                </>
              ) : (
                <span className="hand np-muted">{answered === 0 ? "answer all three to see your result →" : `${correct} of 3 correct so far…`}</span>
              )}
            </div>
          </div>
        </section>

        {/* Sports page and obituary */}
        <section id="sports" className="np-sec np-two">
          <div className="np-wide">
            <div className="np-kicker np-live"><i />Sports page · Live debate</div>
            <h2 className="np-h2">“Attendance should be optional after second year”</h2>
            <div className="np-score">
              <div><small>For</small><b>58</b></div>
              <div className="np-clock"><b>01:42</b><small>Round 2 of 3</small></div>
              <div><small>Against</small><b>42</b></div>
            </div>
            <p className="np-fine">Sample score. Real debates from Den will show here.</p>
          </div>
          <div className="np-obit">
            <div className="np-kicker">Obituary</div>
            <h3>“Can someone send the notes?”</h3>
            <em>2010 to 2026</em>
            <p>Died peacefully in a WhatsApp group of 247 members, of whom 3 had the notes and none replied. Survived by Den, where the notes now live in one place.</p>
            <div className="hand">RIP. will not be missed.</div>
          </div>
        </section>

        {/* Exam-o-scope and crossword */}
        <section className="np-sec np-two np-two-even">
          <div id="scope">
            <h2 className="np-h2 np-rule">Exam-o-scope</h2>
            <p className="np-sub">What the stars say about your semester. Pick your branch.</p>
            <div className="np-chips">
              {Object.keys(SCOPE).map((b) => <button key={b} type="button" aria-pressed={branch === b} onClick={() => setBranch(b)}>{b}</button>)}
            </div>
            <div className="np-box np-scope" aria-live="polite"><div className="np-kicker">{branch} · this semester</div><p>{SCOPE[branch]}</p></div>
          </div>
          <div>
            <h2 className="np-h2 np-rule">Mini crossword</h2>
            <p className="np-sub">No. 1 · Easy, unless you bunked</p>
            <div className="np-cw-wrap">
              <div className="np-cw">
                {GRID.flatMap((row, r) => row.split("").map((ch, c) => {
                  const n = NUMS[`${r},${c}`];
                  if (ch === "#") return <div key={`${r}-${c}`} className="np-cw-x" />;
                  return (
                    <div key={`${r}-${c}`} className="np-cw-c">
                      {n && <span>{n}</span>}
                      {reveal ? <b className="hand">{ch}</b> : <input className="hand" maxLength={1} aria-label={`Row ${r + 1}, column ${c + 1}`} autoComplete="off" />}
                    </div>
                  );
                }))}
              </div>
              <div className="np-clues">
                <b>Across</b>
                <p>1. Three days of no sleep and loud music (4)<br />3. Oral exam where your mind goes blank (4)</p>
                <b>Down</b>
                <p>2. The canteen’s best seller, cutting style (3)</p>
                <button type="button" className="np-btn-small" onClick={() => setReveal((v) => !v)}>{reveal ? "Hide answers" : "Reveal answers"}</button>
              </div>
            </div>
          </div>
        </section>

        {/* Funnies and classifieds */}
        <section id="funnies" className="np-sec np-two">
          <div className="np-wide">
            <h2 className="np-h2 np-rule">The funnies</h2>
            <div className="np-comic">
              <div>
                <div className="np-c-phone"><b>247</b><i>99+</i><span className="hand a">ping!</span><span className="hand b">ping!!</span></div>
                <p className="hand">“which group had the notes again??”</p>
              </div>
              <div>
                <div className="np-c-phone np-c-den"><b>Den<span>.</span></b><Pen viewBox="0 0 160 60" d={["M10 50 30 30", "M80 20V2", "M150 50 130 30"]} className="np-rays" /></div>
                <p className="hand">“wait… it’s ALL here?”</p>
              </div>
              <div>
                <div className="np-c-chai" aria-hidden="true"><i className="cup" /><i className="handle" /><i className="s1" /><i className="s2" /><i className="table" /></div>
                <p className="hand">“notes done. chai time.”</p>
              </div>
            </div>
          </div>
          <div>
            <h2 className="np-h2 np-rule">Classifieds</h2>
            <p className="np-fine">Sample ads. The real ones live in Den’s Market.</p>
            <div className="np-ads">
              <p><b>For sale.</b> Casio fx-991ES, barely used, knows all the answers. ₹600. Hostel B.</p>
              <p><b>Wanted.</b> Engineering Drawing drafter, any condition. Will pay in chai and gratitude.</p>
              <p><b>Cycle.</b> Gearless, one careful owner, bell works. ₹2,200 or best offer.</p>
              <p><b>Lost.</b> One lab coat, last seen at the chemistry lab. Has my name in pen.</p>
            </div>
          </div>
        </section>

        {/* Viva FAQ */}
        <section id="viva" className="np-sec">
          <div className="np-sec-head"><h2>Frequently asked in the viva</h2><span>Supplementary sheet No. 1</span></div>
          <div className="np-sheet np-viva">
            <div className="np-faq np-faq-wide">
              <h3>How do I sign in and get my blue tick?</h3>
              <p><b>Have a college email?</b> Sign in with it. That’s it: no extra step, you get the blue tick straight away ✓</p>
              <p><b>No college email?</b> Sign in with Google, then verify once with your student ID card or two classmates who are already verified. Either one works.</p>
            </div>
            <div className="np-faq"><h3>Is Den free?</h3><p>Yes. Free for every student.</p></div>
            <div className="np-faq"><h3>Who can join?</h3><p>Students aged 18+ at any college in India.</p></div>
            <div className="np-faq"><h3>Is my ID card photo safe?</h3><p>A person checks it once, then it’s deleted.</p></div>
            <div className="np-faq"><h3>Is there an app?</h3><p>The app is coming soon! Till then, Den works in the browser on any phone.</p></div>
            <div className="np-faq"><h3>Someone is being rude. What do I do?</h3><p>Report it in two taps. A moderator reviews every report.</p></div>
          </div>
        </section>

        {/* Final call */}
        <section className="np-final" ref={finalCta}>
          <div className="np-stamp np-stamp-final" aria-hidden="true"><b>PASSED</b><span>100 / 100</span></div>
          <div className="np-kicker">Admission is free</div>
          <h2>{ed ? `${ed} is waiting.` : "Your college is waiting."}</h2>
          <p className="hand">no exam needed, promise :)</p>
          <Link href="/login" className="np-btn np-btn-paper">{joinLabel}</Link>
        </section>

        <footer className="np-foot">
          <span><b className="np-foot-logo">Den<span>.</span></b> · Printed for students aged 18 and over</span>
          <PolicyLinks />
        </footer>
      </div>

      <div className={`np-bar ${showBar ? "show" : ""}`} aria-hidden={!showBar}>
        <span className="np-bar-logo">Den<span>.</span></span>
        <Link href="/login" className="np-btn np-btn-ink" tabIndex={showBar ? 0 : -1}>{joinLabel} →</Link>
      </div>
    </div>
  );
}

/** "Pick your edition": search any college in India. */
function EditionPicker({ colleges, value, onPick }: { colleges: EditionCollege[]; value: Edition | null; onPick: (c: Edition | null) => void }) {
  return (
    <div className="np-edition">
      <label htmlFor="np-ed" className="np-ed-label">Pick your edition:</label>
      {value ? (
        <span className="np-ed-chosen">
          <b>{value.name}</b>
          <button type="button" onClick={() => onPick(null)}>change</button>
        </span>
      ) : (
        <CollegeSearch id="np-ed" className="np-ed-box" placeholder="Type your college" suggestions={colleges} onPick={onPick} />
      )}
      {!value && <span className="hand np-ed-note">← try it, the paper changes</span>}
    </div>
  );
}
