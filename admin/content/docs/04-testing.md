---
title: Testing
summary: How every change is tested before it goes live, what has been tested so far, and what still needs testing before launch.
---

# Testing

*Last updated 26 October 2026.*

## How we test every change

Every change goes through the same steps before it reaches students:

| Step | Who | What |
|---|---|---|
| 1. Type check | Claude | `tsc --noEmit`: TypeScript checks the code for mistakes. |
| 2. Full build | Claude | `next build` for Den, and for Den Admin when it changes. A failed build never goes out. |
| 3. Database tests | Claude | New SQL is run against a throwaway Postgres (PGlite), twice to make sure re-running is safe, with real examples checked. |
| 4. Screen tests | Claude | A real browser (Playwright with Chromium) at phone size (390 × 844) and laptop size. It clicks through the flow and takes screenshots, which Claude looks at. A stand-in Supabase server answers sign-in and search, so no real accounts are touched. |
| 5. Preview | Vercel | Every branch gets its own preview website, built the same way as the live site. |
| 6. Your test | Harsha | You try the preview on your phone and laptop, after running any new database file in Supabase. |
| 7. Merge | Harsha says "merge" | Only then does it go live. Vercel's build status is checked after merging. |

## What has been tested

### Core app (12–15 October)
You tested these yourself on the live site:
- Google sign-in and college-email sign-in.
- Posts, comments and likes.
- One-to-one and group messages.
- Voice Spaces, including on phones.
- Live debates: rounds, mic control and voting.
- Ask a senior.
- Policy pages, the 18+ agreement and Delete my account.

**Bugs found and fixed**
- **Spaces said "doesn't exist" after going live.** The fix was naming the exact database link.
- **One-way audio on phones.** Fixed with the "Sound is off" bar, sound unlocked in the Join tap, and the mic turned back on automatically when a speaker's turn returns.
- **Hosts had to tap "Rejoin as host" after Go live.** They now go straight into the room.
- **Policy pages showed placeholders.** They now read the settings when the page opens.

### Events (15 October)
- RSVP with seat limits, and free tickets with QR codes.
- Scanner with camera and typed codes; check-in and undo; CSV export.
- Calendar links (Google Calendar and .ics).
- Bug fixed: the camera was blocked by a security header.

### Layout, verification, media, speed (23–24 October)
- New layout on phone and laptop, and dark mode.
- All three ways to verify: college email, ID card, and classmates. Read-only mode for unverified accounts. Den Admin's queue, reports and students pages.
- Photos, videos and files in posts, Market, notes, events, articles and chats. Chat files are private to members.
- Caching, lists loading 20 at a time, and chat scrolling.
- **Bug found by you:** new messages appeared only after a refresh. Fixed with separate live channels, catch-up and a fallback check, then tested again.
- **Bug found by you:** the emoji picker covered the message box. It now opens above the box.

### Day 1: landing page (24 October)
- Screenshots of all sections on phone and laptop, in light and night editions and all 7 languages.
- Pick your edition carries the college into sign-up.
- The share card renders at `/opengraph-image`.
- Signed-out visitors to `/` see the landing page, and signed-in students see their college.
- **Bugs fixed:**
  - The share card failed to build (double borders aren't supported there).
  - The share card was blocked for signed-out visitors.
  - The build ran without the college list when the test database was down.
- You tested the preview in a private window on phone and laptop, then merged.

### Day 2: sign-up and colleges (25–26 October)

| Feature | What was tested |
|---|---|
| **India college list** | All 69,775 rows imported into a test database. The 14 starter colleges were matched to their AISHE entries. Searches for short names ("IITB", "DU", "NITT", "govt", "engg") worked. Students adding a college, and merging duplicates in Den Admin, worked. You imported and re-imported it on the live site. |
| **Keep me signed in** | Ticked: the sign-in stays after closing the browser (Supabase's normal long-lived cookies). Unticked: cookies end with the browser, and after 13 hours (simulated) the student is sent to Sign in with "expired". Google always shows the account chooser. |
| **Instant college search** | "CV" and "CVR" find CVR College. Typos ("enginering") still match. Results appear from two letters with no waiting. Den falls back to the database while the list loads. You tested it on your phone. |
| **First and last name** | Pre-filled from Google. Both saved and shown. |
| **Real-name rule** | 19 examples checked in the database: 9 good names in several Indian scripts, and 10 bad ones such as "7637696 @!", "Harsha1" and emoji. Checked in the form as well. |
| **Course list** | Searches like "farm" (finds B Pharm and D Pharm), "b tech", "anthropology", "mass communication", "biotech" and "PhD". "Use what you typed" works too. |
| **Separate Sign in and Sign up** | Both pages, the links between them, and that `next` (the page to return to) is kept. Sign in with an email that has no account says "There's no Den account for … yet. Create your account". |
| **Already has an account** | Sign up with an existing email shows "already has a Den account. Sign in instead", and no code is sent. A new email gets a code. The Google message shows after sign-in. `email_has_account` was checked for upper case, spaces, an account with no profile, and an unknown email. |

**Problems you found on the live site:** "site url is improperly formatted" and "requested path is invalid". Both were Supabase address settings, which you fixed.

### Day 3: home page (27 October)

| Feature | What was tested |
|---|---|
| **Feed with 41 posts** | Scrolled to the end on a phone. Posts load 20 at a time, only visible posts are drawn, and "You're all caught up" shows at the end. |
| **Filter chips** | Doubts and Hostel life show only those posts, each with its coloured tag. |
| **New posts button** | Shows "↑ 3 new posts" when posts arrive, and refreshes and scrolls to the top when tapped. |
| **Post page and share** | `/p/<id>` opens with comments showing. A missing or private post says "This post isn't available". |
| **Empty colleges** | Your own college shows "Start … on Den" with Write the first post and the WhatsApp invite. Another college shows "Nobody from … has posted yet". |
| **Laptop** | The Happening column with events, notes and the invite card, in light and dark mode. |
| **Demo posts script** | Run on a full test copy of the database with all 10 migrations: 12 demo students, 40 posts, 100 comments, 224 likes and 3 events. The remove script deletes all of it, including your own likes and comments on demo posts, and leaves real students and posts alone. |

## Still to test before launch

| What | When |
|---|---|
| Every Day 3–8 change, on preview, as each is made | Days 3–8 |
| Speed check: first screen under 2 seconds on 4G, and a Lighthouse score | Day 9 |
| Security check: database rules, admin functions, headers, dependency audit | Day 9 |
| The new domain: Google sign-in, email links and Den Admin on it | Day 9 |
| Emails from your own domain landing in the inbox, not spam (Gmail, Outlook, college mail) | Day 9 |
| **Final test with 10–20 friends from 2–3 colleges on real phones**: sign up, verify all three ways, post, message, Spaces and debates with several people, events with QR check-in, Market, notes, Articles, dark mode, Delete account | Day 10 |
| Den Admin with real reports and ID cards | Day 10 |

## Known gaps

- There are no automatic tests that run on every push yet. Testing is done by Claude per change, plus your preview check. Adding automated tests (Playwright) to GitHub is a good Phase 2 job.
- Voice Spaces with many people at once (20 or more) haven't been tried yet.
- iPhone Safari needs a check during the Day 10 friends test.
