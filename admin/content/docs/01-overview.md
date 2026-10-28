---
title: Den: overview and story so far
summary: What Den is, everything it does today, and how we got here, day by day.
---

# Den: overview and story so far

*Last updated 26 October 2026. Launch target: Tuesday 3 November 2026.*

## What Den is

Den is a social network for college students in India. Every college gets its own home page, and there is one shared **All India** page for every student on Den. Students post, share notes and past papers, find placement stories, buy and sell on the campus Market, run events, message each other, and talk live in voice rooms.

Two things make Den different from Instagram or WhatsApp groups:

- **Real students only.** Every account belongs to a verified student of a real Indian college. A college email gives the blue tick straight away. Without one, students sign in with Google and verify with their student ID card or two classmates who are already verified.
- **Built around the college.** Posts can be shown to *my college* only or to *All India*. The whole app is organised by college, and every one of India's ~70,000 colleges is already on the list.

Den is for students aged **18 and over** for now (see the Roadmap for 16–17).

**Where it lives**

| What | Address |
|---|---|
| Den (students) | https://den-sable.vercel.app |
| Den Admin (you) | the `den-admin` project on Vercel |
| Code | private GitHub repository `Harsha2414/den` |
| Database and sign-in | Supabase (Mumbai region) |
| Progress tracker | Den Launch Desk (Claude artifact) |

## Everything Den does today

### For students

**Signing up and signing in**
- Separate **Sign in** (`/login`, "Welcome back") and **Sign up** (`/signup`, "Join Den") pages that link to each other.
- **Sign in with Google**, always showing Google's account chooser.
- **College email code**: a 6-digit code sent to an `.ac.in`, `.edu.in` or `.edu` address (or any extra domain you allow). These students get the blue tick at once.
- **Keep me signed in** tick box. If it's unticked, the student is signed out when the browser closes or after 12 hours.
- On Sign up, an email that already has an account gets "This email already has a Den account. Sign in instead", and no code is sent. Google sign-ups with an existing account are signed in with a message saying so.
- After signing in, students go back to the link they were opening (a shared post, say).
- **18+ agreement** to the Terms and Privacy policy. Existing accounts saw it once.

**Profile**
- First and last name, which must look like real names: letters in any Indian language plus `. ' -`, with no digits, symbols or emoji. Den checks this in the form and in the database.
- College picked from all ~70,000 Indian colleges, with instant search. If a college is missing, students can add it, and Den first asks "Is it one of these?".
- Branch / course from a searchable list of 911 Indian degrees and streams, or typed freely.
- Year, photo, bio, dark mode switch, app version, and **Delete my account** (type DELETE).

**Verification (the blue tick)**
- Gmail accounts can look around but can't post, comment, like, message, RSVP, host or vote until verified.
- There are three ways to verify:
  1. **College email code.**
  2. **Student ID card photo.** AI reads it and a clear card gets the tick at once. A person still reviews every card in Den Admin, and the photo is deleted after review or after 7 days.
  3. **Two verified classmates** vouch for the student, with a share link for WhatsApp.
- Banned students see a "suspended" screen.

**College homes and All India**
- **Home page header**: the college name, how many students are on Den and how many posts came in today, and a "Ask a doubt, share campus news…" box to start a post.
- **Happening at your college**: live Spaces, the next events and the newest notes. These are cards to swipe on phones and a column on the right on laptops, with an "Invite classmates" card.
- **Filter chips** on the feed: All, Doubts, Announcements, Lost & found, Hostel life.
- **"↑ New posts" button** when posts arrive while reading (checked every 40 seconds).
- **First-post screen** for a college with no posts yet: "Start <college> on Den", with Write the first post and Invite classmates on WhatsApp.
- **Reactions**: tap the heart to like; long-press it (or right-click on a laptop) for ❤️ 😂 😮 😢 🔥 👏. The button shows only your own reaction and the total count; hover on a laptop to see everyone's reactions.
- **Save posts** with the bookmark. **Saved posts** (in the menu and on Profile) lists them, and only you can see it.
- **Comments** show the commenter's photo and name, with the comment underneath. **Reply** under any comment: replies sit indented under it and start with @Name. Long threads fold to the last two replies.
- **Tappable links** in posts and comments, and **@mentions**: type @ to pick a classmate, and the name links to their profile.
- **Long posts fold** to 6 lines with "…more".
- **⋯ menu** on every post: Edit (first 15 minutes, shows "edited"), Copy link, Delete; for other people's posts, Hide this post, Mute (undo from their profile) and Report. Admins can **Pin** one post to the top of a college.
- **Polls** (2 to 4 options). Everyone sees the totals; nobody sees who voted for what. Tap your choice again to take your vote back.
- **Who reacted**: tap the number next to the heart.
- **Latest / Top this week** switch on the feed.
- **Photos**: full-screen viewer with pinch-zoom and swipe, double-tap to like with a heart burst, and blurred previews while loading. **Data saver** in the menu loads photos only when tapped; it's on by default if the phone asks to save data.
- **Pull down to refresh** on phones. A new post appears at the top straight away.
- **Install Den** from the menu: an app icon on the home screen, plus a "You're offline" page.
- **Share** on every post (the phone's share sheet, or copy link). Each post has its own page (`/p/<id>`) with comments open.
- **Feed**: posts (General, Doubt, Announcement, Lost & found, Hostel life) with up to 4 photos, likes and comments. Each post is shown to *My college* or *All India*.
- **Notes and PYQs**: upload PDF, Word, PowerPoint or Excel files, or a link.
- **Placements**: interview and placement stories.
- **Market**: buy and sell, with up to 6 photos.
- **Events**:
  - Going / Interested, with seat limits.
  - Free tickets with QR codes, and a scanner page for organisers (camera or typed code).
  - Guest list with check-in and undo, and CSV export.
  - Co-organisers, updates, and cancel with a note.
  - Add to Google Calendar or download an .ics file.
- **Articles**: long posts with simple formatting, a cover photo, photos, videos and files inside the text, drafts, topics, likes, comments and share.
- **College switcher** in the top bar: your college, All India, recently visited, and search across every college. There's also a **Browse colleges** page.

**Messages**
- One-to-one and group chats, with unread badges and "Seen".
- Typing indicator and a green online dot.
- Reactions: tap a message, or double-tap for a heart. An emoji panel opens above the message box.
- Photos, videos and files, readable only by the people in that chat.
- Block and report.
- If live updates drop, Den catches up on missed messages automatically.

**Voice Spaces and live debates**
- **Spaces** are live audio rooms with a host, invited speakers, listeners and raise hand. They can start now or be scheduled.
- **Debates** have a moderator, two teams, timed rounds with automatic mic control, and a before/after audience vote. The side that changes the most minds wins.

**Ask a senior**
- An AI helper for placements, exams and college life, limited to 20 questions per student per day (you can change this).

**The landing page** (what signed-out visitors see)
- A newspaper / exam-hall design (design H) with the masthead "Den. The student hangout for every college in India":
  - **Pick your edition**: search any college, and the choice is carried into sign-up.
  - Headline in 7 languages and a night edition.
  - A mini exam and Exam-o-scope.
  - A crossword, funnies and classifieds.
  - A viva FAQ.
  - A Join bar fixed to the bottom on phones.
- The link preview WhatsApp shows (the share card) is in the same newspaper style.

**Policy pages**: Privacy policy, Terms of use and Community guidelines, written for India (DPDP Act 2023, IT Rules 2021).

### For you: Den Admin

Den Admin is a separate website. Only accounts marked as admin can open it.
- **Overview**: the main numbers.
- **Verification**: the ID card queue, classmate flags and history.
- **Reports**: what students reported.
- **Students**: give or remove the tick, ban and unban.
- **Colleges**: import the India list, review colleges added by students (keep or merge), and see counts.
- **Docs**: these documents.

## How we got here

| Date | What happened |
|---|---|
| **12 Oct** | First version, called "Campus Adda" and then renamed **Den**. College homes, feed, notes, placements, Market, events, messages, voice Spaces, debates, Ask a senior. Code put on GitHub. |
| **13 Oct** | Deployed on Vercel with Supabase. Fixed Spaces showing "doesn't exist" after going live, and fixed Google's `redirect_uri_mismatch`. |
| **14 Oct** | Email codes moved to Brevo, with a switch to hide email sign-in. Several fixes for one-way audio in Spaces on phones. App version on the profile. **Launch basics**: policy pages, 18+ agreement, Delete my account. You tested the core features. |
| **15 Oct** | **Event tools**: RSVP, QR tickets and scanner, organiser tools, calendar. |
| **23 Oct** | **New app layout** (top bar, college switcher, side menu, bottom bar), **Articles**, **dark mode**. **Student verification** with read-only mode, and the separate **Den Admin** site. **Photos, videos and files** everywhere. |
| **24 Oct** | **Speed**: caching, lists that load 20 at a time, smooth scrolling. **Chat extras**: typing, online, reactions, emoji panel. Fixed messages appearing only after a refresh. We agreed the **10-day polish plan** for launch on 3 Nov. |
| **24 Oct (Day 1)** | Eight landing page designs (A–H). You chose **H, newspaper + exam hall**, then edited it: removed both editor sections and rewrote the viva answers. Built it for real with one serif logo across Den and the newspaper sign-in and share card. Den Launch Desk tracker started. |
| **25 Oct (Day 2)** | **Every college in India** (AISHE, 69,775), imported in Den Admin. **Keep me signed in** and the Google account chooser. **Instant college search** on the phone. **First and last name**. **Real-name rule**. **Course list** of 911 degrees. You decided to keep 18+ for now. |
| **27 Oct (Day 3)** | Home page: college header and post box, Happening strip/column, filter chips, new-posts button, first-post screen, share and post pages, smaller laptop photos, cleaner switcher, gear icon. Demo posts script for testing. |
| **26 Oct (Day 2)** | **Separate Sign in and Sign up pages**, and the **"already has an account"** notice. **These documents** added to Den Admin. |

### Decisions we made, and why

| Decision | Why |
|---|---|
| Den is 18+ for now | India's DPDP Act counts anyone under 18 as a child. Letting 16–17-year-olds in needs verifiable parental consent, which applies from about May 2027, and the fines go up to ₹200 crore. Date of birth will be asked only when teen mode is built. |
| College email gives the tick straight away; Gmail needs an ID card or classmates | Keeps Den to real students without blocking colleges that don't give students an email. |
| Every change on its own branch, tested on a preview, merged only when you say "merge" | The live site never gets untested changes. |
| Landing page H (newspaper + exam hall) | Feels Indian and memorable, works in many languages, and isn't another generic app page. |
| The college list from AISHE | It's the government's official list of higher education institutions. We used the MIT-licensed copy on GitHub, so no Excel files were needed. |
| Search the college list on the phone | Results appear as you type, from two letters ("CV" finds CVR), with no waiting for the server. |
| Den Admin is a separate website with no service key | Students never see it, and every admin action is checked again by the database. |
| No secrets in the code | All keys live in Vercel's environment variables. |

### Problems we hit and fixed

- **Spaces said "doesn't exist" after going live.** The database couldn't tell which link to the host's profile to use. Each link is now named exactly.
- **Voices didn't play on phones.** Phones block sound until a tap, so audio now starts inside the Join tap, with a "Sound is off, tap to hear" bar as a fallback.
- **Policy pages showed placeholder details.** They were built before the settings were added, so they now read the settings when the page opens.
- **The ticket scanner camera was blocked.** A security header was turning the camera off; it now allows it on Den.
- **New messages only appeared after a refresh.** One failed live channel was silently stopping all updates. Messages, reactions and typing now use separate channels, with a catch-up step and a 4-second fallback check.
- **Supabase address settings.** The Site URL was missing `https://` and Den Admin's address wasn't in the Redirect URLs, which caused "site url is improperly formatted" and "requested path is invalid". You fixed both in Supabase.
- **College search was slow, and "CV" didn't find CVR.** The whole list now lives on the phone and is searched in the background.
- **A test profile was named "7637696 @!".** That led to the real-name rule.
- **Signing up with an old email just signed in silently.** Den now says the account already exists.
