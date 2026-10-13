# Den

The student hangout for every college in India.

- **Home page for every college** plus a common **All India** page
- **Feed** with comments; each post is visible to *my college* only or to *All India*
- **Notes and PYQs**, **placement stories**, **campus market** and **events**
- **Private messaging**: one-to-one chats and group chats, unread badges, "Seen", block and report
- **Voice Spaces**: live audio rooms with a host, invited speakers, listeners and raise hand
- **Live Debate Spaces**: a moderator, two teams, timed rounds with automatic mic control, and a before/after audience vote (the side that changes the most minds wins)
- **Ask a senior**: an AI helper for placements, exams and college life, with a daily limit per student
- Sign-in with **Google** or a **one-time code sent to a college email** (college-email users get a verified badge)

Built with Next.js 15, Supabase (database, logins, live updates), LiveKit (voice) and the Anthropic API.

---

## Deploy it (about 20 minutes)

You need four free accounts: **Supabase**, **LiveKit Cloud**, **Vercel** and **Anthropic** (the AI helper is paid per use; add a small amount of credit).

### 1. Supabase: database and sign-in

1. Go to [supabase.com](https://supabase.com) and create a new project. Pick the **Mumbai (ap-south-1)** region so it's fast for Indian students. Save the database password somewhere safe.
2. Open **SQL Editor**, then **New query**. Paste everything from `supabase/migrations/0001_init.sql` and click **Run**. You should see "Success".
3. Make another new query, paste `supabase/seed.sql` and click **Run**. This adds 50 well-known colleges. Students can add their own college when they sign up.
4. Open **Authentication > Emails > Templates**. In both **Confirm sign up** and **Magic link or OTP**, replace the body with something like:

   ```html
   <h2>Your Den sign-in code</h2>
   <p>Enter this code to sign in: <strong>{{ .Token }}</strong></p>
   <p>If you didn't ask for this, you can ignore this email.</p>
   ```

5. Open **Project Settings > API** (or **API Keys**) and copy:
   - the **Project URL**
   - the **anon** key (newer projects call it the **publishable** key)
   - the **service_role** key (newer projects: **secret** key). Keep this one secret.

> **Before you invite lots of students:** Supabase's built-in email sender is only meant for testing and sends a small number of emails per hour. Add your own email sender under **Authentication > Emails > SMTP Settings** (Resend, Brevo, Amazon SES and others have free tiers).

### 2. Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com), create a project, then go to **APIs & Services > OAuth consent screen** and fill in the app name (Den) and your email.
2. Go to **Credentials > Create credentials > OAuth client ID**, choose **Web application**.
3. Under **Authorized redirect URIs** add: `https://YOUR-PROJECT.supabase.co/auth/v1/callback` (use your Supabase Project URL).
4. Copy the **Client ID** and **Client secret**, then in Supabase open **Authentication > Sign In / Providers > Google**, turn it on and paste both.

### 3. LiveKit: voice for Spaces

1. Go to [cloud.livekit.io](https://cloud.livekit.io) and create a project.
2. Open **Settings > API keys**, create a key, and copy the **WebSocket URL** (starts with `wss://`), the **API key** and the **API secret**.

### 4. Anthropic: Ask a senior

1. Go to [console.anthropic.com](https://console.anthropic.com), add billing credit, and create an **API key**.
2. Each student gets 20 questions a day by default (change `AI_DAILY_LIMIT`).

### 5. Vercel: put it online

1. Go to [vercel.com](https://vercel.com), sign in with GitHub, click **Add New > Project** and import the `den` repository.
2. Before clicking Deploy, open **Environment Variables** and add every line from `.env.example` with your real values:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon / publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role / secret key |
   | `NEXT_PUBLIC_LIVEKIT_URL` | LiveKit `wss://` URL |
   | `LIVEKIT_API_KEY` | LiveKit API key |
   | `LIVEKIT_API_SECRET` | LiveKit API secret |
   | `ANTHROPIC_API_KEY` | Anthropic API key |
   | `ANTHROPIC_MODEL` | `claude-sonnet-5-5` |
   | `AI_DAILY_LIMIT` | `20` |

3. Click **Deploy**. When it's done you get a link like `https://den-yourname.vercel.app` (you can add your own domain later).
4. Back in Supabase, open **Authentication > URL Configuration**:
   - **Site URL**: your Vercel link
   - **Redirect URLs**: add `https://YOUR-VERCEL-LINK/auth/callback`

> If you add or change a variable that starts with `NEXT_PUBLIC_` after deploying, click **Redeploy** in Vercel. Those values are built into the app.

### 6. Make yourself an admin

Sign up on your live site first. Then in Supabase **SQL Editor** run (with your email):

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'you@example.com');
```

Admins can read all reports (in Supabase **Table Editor > reports**) and delete any post through the database.

### Allowing more college email domains

Email codes work automatically for addresses ending in `.ac.in`, `.edu.in` and `.edu`. For a college whose email ends in something else (for example `christuniversity.in`), run:

```sql
insert into public.allowed_email_domains (domain) values ('christuniversity.in');
```

---

## Run it on your computer

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev                  # open http://localhost:3000
```

Add `http://localhost:3000/auth/callback` to Supabase's Redirect URLs to test Google sign-in locally.

## How privacy is enforced

All rules live in the database (row-level security), so they hold even if someone calls the API directly:

- Messages are readable only by members of that conversation. Blocked students can't message each other.
- "My college" posts are visible only to students of that college.
- Students can't mark themselves verified or admin, add email domains, promote themselves to speaker, or change debate rounds. Only the server, after checking the host, can do those.
- Reports are visible only to the reporter and admins.

## Before a public launch (India)

- Social platforms in India must follow the **IT Rules, 2021**, including publishing a grievance officer's contact and handling complaints within set timelines.
- The **Digital Personal Data Protection Act, 2023** requires verifiable parental consent for users under 18. Some first-year students may be 17.
- Publish a privacy policy and community guidelines. Get advice from a lawyer before launch; this README isn't legal advice.

## Project layout

```
supabase/migrations/0001_init.sql   database tables, privacy rules, functions
supabase/seed.sql                   starter list of colleges
src/app/login                       Google + college-email sign-in
src/app/(main)/c/[id], /india       college and All India home pages
src/app/(main)/messages             inbox and chats
src/app/(main)/spaces               Spaces list and live rooms
src/app/(main)/ask                  Ask a senior
src/app/api/spaces/[id]/token       issues voice room passes (mic only for allowed speakers)
src/app/api/spaces/[id]/control     host controls: start, end, invite, rounds, remove
src/app/api/ask                     AI helper with daily limit
src/lib/debate.ts                   debate rounds, who can speak, scoring
```
