---
title: Roadmap
summary: Phase 1 (launch on 3 November), Phase 2 (the first months after launch) and Phase 3 (growing across India), plus your own to-do list.
---

# Roadmap

*Last updated 26 October 2026. The live, day-to-day list is in Den Launch Desk; this page is the bigger picture.*

## Phase 1: launch (now → Tuesday 3 November 2026)

**Goal:** a polished Den that 10–20 friends have tested on real phones, on its own domain, ready to share with the first colleges.

### The 10-day polish plan

| Day | Focus | Status |
|---|---|---|
| 1 | Landing page and sign-in | **Done**, except the club/fest section and "Be the first from your college" |
| 2 | Sign-up and the college list | **Mostly done**: India college list, instant search, Keep me signed in, first and last name, real-name rule, course list, separate Sign in and Sign up, "already has an account". **Left:** profile step polish, a shorter 18+ agreement, a guided "Get your blue tick" step, and new students returning to the shared link |
| 3 | Home feed, top bar and menu | **On preview**: header and post box, Happening, filter chips, new-posts button, first-post screen, share, post pages, photo sizes, switcher and menu fixes |
| 4 | Posting, comments and profile pages | To do |
| 5 | Messages polish | To do |
| 6 | Events, Spaces and debates polish | To do |
| 7 | Notes and PYQs, placements, Market, Articles polish | To do |
| 8 | Phone notifications (messages, replies, event reminders) and empty, loading and error screens | To do |
| 9 | Domain, photo safety check before upload, speed and security check, visitor numbers (Vercel Analytics) | To do |
| 10 | Final test with friends on real phones, then **launch** | To do |

### Your list for launch

| Item | Why |
|---|---|
| **Buy the domain** (for example joinden.in) | Needed for proper email and a trustworthy link. Then update Supabase's Site URL and Redirect URLs |
| **Google sign-in → "In production"** (Google Cloud → OAuth consent screen) | In Testing mode only listed testers can sign in |
| **Line up 10–20 test friends** from 2–3 colleges | For Days 9–10; they also give Den its first posts |
| Send emails from your own domain (Brevo) | Sign-in emails stop landing in spam |
| Upgrade Supabase to Pro (about $25 a month) | The free plan holds only about 1 GB of photos and files |
| Footer details: contact email, Instagram, "Report a problem" address | Shown on the landing page and policy pages |
| Real campus photos (yours, with permission, or chosen stock photos) | For the front page |
| Get the headline translations checked by native speakers | Hindi, Tamil, Telugu, Kannada, Bengali, Marathi |
| Trademark search for "Den" (ipindia.gov.in, classes 9, 38, 41, 42, 45) | Before spending on the brand |
| Lawyer review of the Terms and Privacy policy | Required care under the IT Rules and the DPDP Act |
| Optional: set `ANTHROPIC_MODEL=claude-haiku-5-5` in Vercel | Much cheaper Ask a senior |
| Delete merged branches on GitHub | Housekeeping |

## Phase 2: the first months after launch (November 2026 → early 2027)

**Goal:** keep the first students coming back, make Den easy to find, and make moderation manageable.

These are proposals; you decide the order.

| Idea | What it is |
|---|---|
| **Club and fest section** | Pages for clubs and fests, to bring in club heads and class reps |
| **Campus stories** | Instagram-style stories for each college |
| **Den-wide search** and a **better article editor** | Find posts, people, notes and articles across Den |
| **Public college pages Google can find** | "Den for IIT Bombay" pages, so searches like "IIT Bombay PYQs" lead to Den |
| **Campus moderators** | Trusted students who help review reports for their college |
| **Translate more than the headline** | Buttons and main lines in each language |
| **Automatic tests on every push** | Playwright tests in GitHub, so bugs are caught before a preview |
| **Usage numbers in Den Admin** | Daily students, posts and colleges, and where sign-ups drop off |
| **Cartoon strip** by an illustrator | For the landing page funnies |

## Phase 3: growing across India (2027)

**Goal:** Den as an app in students' pockets, trusted verification, and room for younger students when the law allows.

| Idea | What it is |
|---|---|
| **Den app in the Play Store and App Store** | The landing page already says "coming soon" |
| **DigiLocker or APAAR verification** | Government-backed student verification instead of ID card photos |
| **Teen mode for 16–17-year-olds** | Private date of birth, a one-time prompt for existing students, under-18 protections and **verifiable parental consent** (DPDP Rule 10, from about May 2027). Only when you decide to open Den to 16–17 |
| **College leaderboard** | Which colleges are most active, once there are real numbers |
| **Campus map design (E)** | The landing page direction you liked, built properly |
| **Admit card at sign-up** (shareable) and **invite coupon for 3 friends** | Growth ideas you parked |
| **Letters to the editor / From the editor** | Can return once there are real student quotes |

## Things we've deliberately parked

- **Asking for date of birth.** It comes with teen mode, not before.
- **16–17 sign-ups.** Den stays 18+ for now.
- **Campus map, admit card, invite coupon, editor letters.** Liked, but saved for later.
