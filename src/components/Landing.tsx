import Link from "next/link";
import Icon, { VerifiedTick } from "./Icon";
import PolicyLinks from "./PolicyLinks";
import "./landing.css";

type IconName = Parameters<typeof Icon>[0]["name"];

const FEATURES: { icon: IconName; title: string; text: string; tone: string }[] = [
  { icon: "book", title: "Notes and PYQs", text: "Previous year papers and class notes from your own seniors, sorted by course and semester.", tone: "teal" },
  { icon: "briefcase", title: "Placement stories", text: "Who came, what they asked, what they paid. Real interview rounds, told by students who sat them.", tone: "saffron" },
  { icon: "ticket", title: "Events and passes", text: "Fests, workshops and club meets. RSVP in one tap and walk in with a QR ticket.", tone: "rose" },
  { icon: "mic", title: "Voice Spaces and debates", text: "Drop into a live room to talk, or watch two sides argue it out with a timer and a vote.", tone: "leaf" },
  { icon: "msg", title: "Messages", text: "Chat one-to-one or in groups. Share photos, PDFs and videos with your batch.", tone: "teal" },
  { icon: "bag", title: "Market", text: "Buy and sell books, cycles, calculators and hostel stuff with students on your campus.", tone: "saffron" },
];

export default function Landing() {
  return (
    <div className="ld">
      <header className="ld-top">
        <div className="ld-wrap ld-bar">
          <Link href="/" className="brand ld-brand" aria-label="Den home">Den<span>.</span></Link>
          <nav className="ld-nav" aria-label="Main">
            <a href="#features">Features</a>
            <a href="#safety">Safety</a>
            <Link href="/login" className="ld-signin">Sign in</Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="ld-wrap ld-hero">
          <div className="ld-hero-copy">
            <p className="ld-kicker"><span className="ld-live" aria-hidden="true" /> Made for Indian colleges</p>
            <h1>Your whole campus, <em>in one place.</em></h1>
            <p className="ld-lede">Den gives every college in India its own home for notes, PYQs, placement stories, events and live voice rooms, plus one feed shared by students across the country.</p>
            <div className="ld-ctas">
              <Link href="/login" className="ld-btn ld-btn-main">Join your college <Icon name="chevRight" size={18} /></Link>
              <a href="#how" className="ld-btn ld-btn-quiet">How it works</a>
            </div>
            <ul className="ld-trust">
              <li><Icon name="shield" size={16} /> Students only</li>
              <li><Icon name="check" size={16} /> Free to use</li>
              <li><Icon name="globe" size={16} /> Works on any phone</li>
            </ul>
          </div>

          <div className="ld-hero-art" aria-hidden="true">
            <div className="ld-phone">
              <div className="ld-screen">
                <div className="ld-s-bar"><b>Den<span>.</span></b><i>Your college ▾</i></div>
                <div className="ld-s-banner">
                  <strong>Your campus</strong>
                  <small>Notes · Placements · Events</small>
                  <div className="ld-s-stats"><span><b>1.2k</b>students</span><span><b>340</b>notes</span><span><b>12</b>events</span></div>
                </div>
                <div className="ld-s-tabs"><span className="on">For you</span><span>Notes</span><span>Placements</span><span>Market</span></div>
                <div className="ld-s-card">
                  <div className="ld-s-who"><span className="ld-av a1">A</span><span><b>Ananya <VerifiedTick /></b><small>3rd year · CSE</small></span></div>
                  <p>Uploaded DBMS mid-sem PYQs (2021 to 2025) with solutions. Good luck for Monday!</p>
                  <div className="ld-s-file"><Icon name="file" size={14} /> DBMS_PYQs_solved.pdf</div>
                  <div className="ld-s-acts"><span><Icon name="heart" size={13} fill /> 128</span><span><Icon name="msg" size={13} /> 24</span></div>
                </div>
                <div className="ld-s-card ld-s-event">
                  <div className="ld-s-date"><b>14</b>NOV</div>
                  <div><b>Hackathon night</b><small>Main auditorium · 210 going</small></div>
                </div>
              </div>
            </div>
            <div className="ld-float f1"><Icon name="ticket" size={16} /> Pass booked</div>
            <div className="ld-float f2"><span className="ld-mini-live" /> 48 listening in a Space</div>
            <div className="ld-float f3"><VerifiedTick /> Verified student</div>
          </div>
        </section>

        {/* Two feeds */}
        <section className="ld-wrap ld-split">
          <div className="ld-scope">
            <div className="ld-scope-card mine">
              <span className="ld-chip">Your college</span>
              <h3>Just your campus</h3>
              <p>Your batch, your clubs, your seniors. Notes, placements and events that only matter here.</p>
            </div>
            <div className="ld-scope-card india">
              <span className="ld-chip">All India</span>
              <h3>Every campus, together</h3>
              <p>Switch over to see what students across India are posting, debating and building.</p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="ld-wrap ld-sec" id="features">
          <h2 className="ld-h2">Everything college life needs</h2>
          <p className="ld-sub">The things you now juggle across ten WhatsApp groups, in one app.</p>
          <div className="ld-grid">
            {FEATURES.map((f) => (
              <article key={f.title} className={`ld-feat t-${f.tone}`}>
                <span className="ld-ic"><Icon name={f.icon} size={22} /></span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
          <div className="ld-more">
            <span><Icon name="article" size={16} /> Articles</span>
            <span><Icon name="spark" size={16} /> Ask a senior (AI)</span>
            <span><Icon name="cap" size={16} /> Student profiles</span>
            <span><Icon name="moon" size={16} /> Dark mode</span>
          </div>
        </section>

        {/* Safety */}
        <section className="ld-wrap ld-sec" id="safety">
          <div className="ld-safe">
            <div>
              <span className="ld-safe-ic"><Icon name="shield" size={26} /></span>
              <h2 className="ld-h2">Only real students</h2>
              <p className="ld-sub">Anyone can look around, but only verified students can post, comment or message. You get a blue tick once you&apos;re verified.</p>
            </div>
            <ol className="ld-ways">
              <li><Icon name="mail" size={20} /><span><b>College email</b>Get a code on your college address. Done in a minute.</span></li>
              <li><Icon name="idcard" size={20} /><span><b>Student ID card</b>Snap your card. A real person checks it, then the photo is deleted.</span></li>
              <li><Icon name="users" size={20} /><span><b>Two classmates</b>Two verified students from your college vouch for you.</span></li>
            </ol>
          </div>
          <p className="ld-fine">Den is for students aged 18 and over. Report any post or person in two taps, and a moderator reviews every report.</p>
        </section>

        {/* How it works */}
        <section className="ld-wrap ld-sec" id="how">
          <h2 className="ld-h2">Start in under a minute</h2>
          <ol className="ld-steps">
            <li><b>1</b><h3>Sign in</h3><p>With Google or your college email. No new password.</p></li>
            <li><b>2</b><h3>Pick your college</h3><p>Choose your college and course, and add a photo if you like.</p></li>
            <li><b>3</b><h3>Get your blue tick</h3><p>Verify once, then post, chat and join events.</p></li>
          </ol>
        </section>

        {/* Final call */}
        <section className="ld-wrap ld-sec">
          <div className="ld-final">
            <h2>Your college is waiting.</h2>
            <p>Bring your batch along. Den is better with friends.</p>
            <Link href="/login" className="ld-btn ld-btn-light">Join Den, it&apos;s free <Icon name="chevRight" size={18} /></Link>
          </div>
        </section>
      </main>

      <footer className="ld-wrap ld-foot">
        <div><span className="brand">Den<span>.</span></span><small>The student hangout for every college in India.</small></div>
        <PolicyLinks />
      </footer>
    </div>
  );
}
