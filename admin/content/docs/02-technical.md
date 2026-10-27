---
title: Technical guide
summary: Languages, frameworks, libraries, services, how the app is built, the database, security and how changes go live.
---

# Technical guide

*Last updated 26 October 2026.*

## In one picture

```
 Student's phone or laptop                    You
 ┌──────────────────────────┐        ┌──────────────────────┐
 │ Den (Next.js web app)    │        │ Den Admin (Next.js)  │
 │ den-sable.vercel.app     │        │ den-admin on Vercel  │
 └────────────┬─────────────┘        └──────────┬───────────┘
              │                                 │
              ▼                                 ▼
 ┌────────────────────────────────────────────────────────────┐
 │ Supabase (Mumbai): Postgres database, sign-in, live        │
 │ updates (Realtime), file storage. Privacy rules live here. │
 └────────────────────────────────────────────────────────────┘
   Den also talks to: LiveKit (voice Spaces), Anthropic (Ask a
   senior, reading ID cards), Brevo (emails), Google (sign-in)
```

Both websites are hosted on **Vercel**. They come from one GitHub repository, `Harsha2414/den`: Den is the main folder and Den Admin is the `admin/` folder.

## Languages

| Language | Where | Size (lines) |
|---|---|---|
| **TypeScript** (with React's TSX) | All app code for Den and Den Admin: pages, components, server routes | ~9,000 |
| **SQL** (PostgreSQL) | Database tables, privacy rules, functions (`supabase/migrations`) | ~2,000 |
| **CSS** | Styling, plain CSS with colour "tokens" (no CSS framework) | ~1,200 |
| **Python** | One-off data scripts that build the college and course lists (`scripts/`) | ~530 |
| **Markdown** | The README and these documents | — |

## Frameworks and platforms

| Name | Version | What it does for Den |
|---|---|---|
| **Next.js** (App Router) | 15.5.28 | The web framework for both sites: pages, routing, server code, image cards |
| **React** | 19.1.1 | Builds the screens |
| **Node.js** | 22 | Runs the server code on Vercel |
| **Supabase** | hosted | Postgres database, Google and email-code sign-in, Realtime (live chat), Storage (photos and files) |
| **Vercel** | hosted | Hosting, a preview site for every branch, a daily clean-up job (cron) |
| **LiveKit Cloud** | hosted | Live audio for Spaces and debates |
| **Anthropic Claude API** | hosted | Ask a senior and reading student ID cards (model set by `ANTHROPIC_MODEL`; default `claude-sonnet-5-5`) |
| **Brevo** | hosted | Sends verification emails (SMTP) |
| **Google Cloud (OAuth)** | hosted | "Sign in with Google" |

## Libraries

**Den**

| Library | Version | Used for |
|---|---|---|
| `@supabase/supabase-js`, `@supabase/ssr` | 2.117.1, 0.12.7 | Talking to the database; sign-in cookies on the server |
| `@tanstack/react-query` | 5.104.1 | Caching pages so going back is instant |
| `react-virtuoso` | 4.18.16 | Long feeds and chats that only draw what's on screen |
| `livekit-client`, `@livekit/components-react`, `livekit-server-sdk` | 2.22.3, 2.9.24, 2.19.1 | Voice rooms and room passes |
| `@anthropic-ai/sdk` | 0.128.0 | Ask a senior and the ID card reader |
| `@leeoniya/ufuzzy` | 1.0.19 | Instant, typo-tolerant college search on the phone |
| `emoji-mart`, `@emoji-mart/data` | 5.6.0, 1.2.1 | Emoji panel and reactions (loaded only when opened) |
| `qrcode` | 1.5.4 | Event ticket QR codes |
| `jsqr` | 1.4.0 | Reading QR codes with the camera at check-in |
| `nodemailer` | 10.1.7 | Sending verification code emails |
| `server-only` | 0.0.1 | Stops secret server code from reaching the browser |
| `typescript` | 5.9.2 | Type checking |

**Den Admin**: Next.js, React, the Supabase libraries, and `marked` (18.0.14) to show these documents.

**Fonts** (Google Fonts): **Fraunces** (the serif for the logo and headings), **Hind** (body text, which covers Hindi and Marathi script too), and **Kalam** (handwriting, only on the landing and sign-in pages).

**Data sources**
- The college list comes from **AISHE** (All India Survey on Higher Education), via the MIT-licensed GitHub project `BrahmjotSingh0/aishe-institutions-list`. The 70,865 rows were cleaned to 69,775 colleges.
- The course list (911 degrees and streams) was written for Den in `scripts/build-courses.py`.

## How the code is organised

```
den/
├─ src/app/                 Den's pages
│  ├─ welcome/              landing page (signed-out visitors to "/")
│  ├─ login/, signup/       Sign in and Sign up
│  ├─ auth/callback/        where Google and email links return to
│  ├─ onboarding/           profile setup after sign-up
│  ├─ (main)/               the app: c/[id] college home, india, messages,
│  │                        spaces, events, articles, ask, me, u/[id],
│  │                        verify, vouch, colleges
│  ├─ api/                  server routes: ask, spaces token/control,
│  │                        verify email/id, account delete, cron cleanup,
│  │                        colleges/extra
│  ├─ privacy, terms, guidelines   policy pages
│  └─ opengraph-image, twitter-image   share cards
├─ src/components/          screens and pieces (AuthForm, Chrome, Landing,
│                           CollegeSearch, CourseSearch, ProfileForm, ...)
├─ src/lib/                 logic (debate rules, college index, courses,
│                           remember-me, media, supabase clients, ...)
├─ src/middleware.ts        sign-in checks, landing page, 12-hour sessions
├─ public/data/             colleges-v1.json, courses-v1.json
├─ supabase/migrations/     0001 … 0010 database changes
├─ scripts/                 Python scripts that build the data files
└─ admin/                   Den Admin (its own Next.js app)
   ├─ src/app/(panel)/      overview, verification, reports, students,
   │                        colleges, docs
   ├─ content/docs/         these documents (Markdown)
   └─ public/data/          aishe-colleges.json (for the import)
```

## The database

Supabase runs PostgreSQL. Every change to it is a numbered SQL file that you run once in the Supabase SQL Editor. Running one again is safe.

| File | What it adds |
|---|---|
| `0001_init.sql` | Colleges, profiles, posts, notes, placements, Market, events, comments, likes, conversations and messages, Spaces, debates, reports, blocks, AI usage, and all privacy rules |
| `0002_launch_basics.sql` | 18+ terms agreement, clean-up of likes on deleted items |
| `0003_events.sql` | RSVPs, tickets, co-organisers, event updates |
| `0004_articles.sql` | Articles, drafts, comments |
| `0005_verification.sql` | Student verification, read-only mode, admin functions |
| `0006_media.sql` | Storage buckets and rules for photos, videos and files |
| `0007_chat_extras.sql` | Message reactions |
| `0008_college_list.sql` | The India college list: search, import, review, merge |
| `0009_name_rules.sql` | Names must look like real names |
| `0010_account_exists.sql` | Sign up can tell when an email already has an account |
| `0011_reactions_saved.sql` | Reactions on posts, and saved posts (private to each student) |

**Important database functions**
- `search_colleges`, `active_colleges`: college search and the colleges that already have students.
- `admin_import_colleges`, `admin_merge_college`, `admin_mark_college`: used by Den Admin's Colleges tab.
- `looks_like_name`: the real-name rule.
- `email_has_account`: answers yes or no only.
- `bump_ai_usage`: the daily Ask a senior limit.

## Security and privacy

- **Privacy rules live in the database** (row-level security), so they hold even if someone bypasses the app:
  - messages are readable only by chat members;
  - "My college" posts only by that college's students;
  - reports only by the reporter and admins;
  - students can't make themselves verified or admin.
- **Unverified accounts are read-only.** The database itself refuses their posts, messages, likes and so on.
- **Den Admin has no service key.** Every admin action goes through a database function that checks `is_admin`. `ADMIN_EMAILS` is an optional extra lock. Den Admin is hidden from search engines.
- **Files:** chat files use short-lived signed links. ID card photos are deleted after review or after 7 days by a daily clean-up job (`vercel.json`, 21:30 UTC).
- **Sessions:** "Keep me signed in" off means a browser-session cookie plus a 12-hour limit checked on every page.
- **Secrets** are only in Vercel environment variables, never in the code.
- **Security headers** on both sites. The camera is allowed on Den for the ticket scanner.
- **Deleting an account** removes the student and all their data and files.

## Settings (Vercel environment variables)

Only the names are listed here; the values are in Vercel. Variables marked **secret** must never be shared.

| Den | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Connect to Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` **secret** | Server-only jobs (Ask limit, account deletion, clean-up) |
| `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` **secret** | Voice Spaces |
| `ANTHROPIC_API_KEY` **secret**, `ANTHROPIC_MODEL`, `AI_DAILY_LIMIT` | Ask a senior and the ID reader |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` **secret**, `SMTP_FROM` | Verification emails (Brevo) |
| `CRON_SECRET` **secret** | Protects the daily clean-up |
| `NEXT_PUBLIC_EMAIL_CODES` | Switch to hide email-code sign-in |
| `NEXT_PUBLIC_LEGAL_OPERATOR`, `NEXT_PUBLIC_LEGAL_CITY`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_GRIEVANCE_OFFICER`, `NEXT_PUBLIC_GRIEVANCE_EMAIL` | Details shown on the policy pages |

| Den Admin | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as Den |
| `NEXT_PUBLIC_DEN_URL` | Link back to Den |
| `ADMIN_EMAILS` | Optional extra lock on who can open Den Admin |

## How a change goes live

1. Claude makes the change on its own **branch** (for example `feature/signin-signup`).
2. It's checked locally: type check, a full build, database tests where needed, and screenshots on a phone-sized screen.
3. The branch is pushed to GitHub, and Vercel builds a **preview** website for it.
4. **You test the preview.** If there's a new database file, you run it in Supabase first.
5. You say **"merge"**. The branch joins `main`, and Vercel updates the live sites within a couple of minutes.
6. The change is recorded in Den Launch Desk.

Commits are made under your GitHub name (Harsha2414) with Claude listed as co-author.

## Speed

- Pages are cached on the phone (TanStack Query), so going back is instant.
- Feeds and lists load 20 items at a time and draw only what's visible.
- The college list (about 1 MB compressed) downloads once when a college search box first appears. It's searched in a background thread, so results show as you type.
- Fonts are cut to one serif plus Hind. The handwriting font loads only on the landing and sign-in pages.
- Photos shrink on the phone before upload. Videos are limited to 50 MB and files to 20 MB.
