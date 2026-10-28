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

You need four free accounts: **Supabase**, **LiveKit Cloud**, **Vercel** and **Anthropic** (the AI helper is paid per use; add a small amount of credit), plus an email sender for sign-in codes (your Gmail works for testing).

### Setup progress

Tick these off as you go.

- [x] Code pushed to GitHub (`Harsha2414/den`)
- [x] Supabase project created and both SQL files run
- [x] Email sender (SMTP) set up: Brevo (Gmail sender, for testing)
- [x] Email templates updated with `{{ .Token }}`
- [x] Supabase URL and keys copied
- [x] Google sign-in connected
- [x] LiveKit keys copied
- [x] Anthropic API key created
- [x] Deployed on Vercel with all keys
- [x] Vercel link added to Supabase URL settings
- [ ] Signed up and made yourself admin
- [x] Tested core features: posts, messages, voice Spaces, debates, Ask a senior, Google + college-email sign-in
- [x] Privacy policy, terms, community guidelines, 18+ agreement, Delete my account
- [ ] Before public launch: own domain + Brevo/Resend sender, trademark check, lawyer review of policies

### 1. Supabase: database and sign-in

1. Go to [supabase.com](https://supabase.com) and create a new project. Pick the **Mumbai (ap-south-1)** region so it's fast for Indian students. Save the database password somewhere safe.
2. Open **SQL Editor**, then **New query**. Paste everything from `supabase/migrations/0001_init.sql` and click **Run**. You should see "Success".
3. Make another new query, paste `supabase/migrations/0002_launch_basics.sql` and click **Run** (terms agreement and cleanup).
   Then do the same with `supabase/migrations/0003_events.sql` (RSVPs, tickets, co-organisers, event updates), then `supabase/migrations/0004_articles.sql` (articles, drafts, comments), then `supabase/migrations/0005_verification.sql` (student verification, read-only mode, Den Admin), then `supabase/migrations/0006_media.sql` (photos, videos and files), then `supabase/migrations/0007_chat_extras.sql` (message reactions), then `supabase/migrations/0008_college_list.sql` (college search and review), then `supabase/migrations/0009_name_rules.sql` (names must be real names), then `supabase/migrations/0010_account_exists.sql` (Sign up tells you when an email already has an account), then `supabase/migrations/0011_reactions_saved.sql` (reactions and saved posts), then `supabase/migrations/0012_comment_replies.sql` (replies to comments), then `supabase/migrations/0013_feed_extras.sql` (edit posts, hide and mute, polls, pinned posts, Top this week). After 0008, open Den Admin → Colleges → **Import the India list** to load every college in India (about 70,000, from AISHE via the MIT-licensed `aishe-institutions-list` project; rebuild the file with `python3 -I scripts/prepare-colleges.py`).
4. Make another new query, paste `supabase/seed.sql` and click **Run**. This adds 50 well-known colleges. Students can add their own college when they sign up.
5. **Set up an email sender (required for college-email codes).** Supabase's built-in sender only emails members of your own Supabase team, so students won't get codes without this. Open **Authentication > Emails > SMTP Settings**, turn on **Enable custom SMTP**, and pick one:

   **For testing: your Gmail** (a few hundred emails a day; codes may land in spam)
   1. Turn on 2-Step Verification for your Google account.
   2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), create an app password named "Den" and copy the 16-character code.
   3. In Supabase fill in: Sender email = your Gmail address, Sender name = `Den`, Host = `smtp.gmail.com`, Port = `587`, Username = your full Gmail address, Password = the app password (no spaces). Save.

   **For launch: your own domain with Brevo or Resend** (reliable delivery, codes come from your brand)
   1. Buy a domain (for example `joinden.in`) and add it in Brevo under **Senders, Domains & Dedicated IPs**. Add the DNS records Brevo shows you so the domain is verified.
   2. Create a sender such as `no-reply@joinden.in`, then go to **Settings > SMTP & API** and generate an **SMTP key** (not an API key).
   3. In Supabase fill in: Sender email = `no-reply@joinden.in`, Sender name = `Den`, Host = `smtp-relay.brevo.com`, Port = `587`, Username = your Brevo login email, Password = the SMTP key. Save.

   After saving, Supabase allows about 30 emails an hour. Raise it under **Authentication > Rate Limits** when more students join.

6. Open **Authentication > Emails > Templates**. In both **Confirm sign up** and **Magic link or OTP**, switch the message editor to its **Source** (code) view and replace the body with:

   ```html
   <h2>Your Den sign-in code</h2>
   <p>Enter this code to sign in: <strong>{{ .Token }}</strong></p>
   <p>If you didn't ask for this, you can ignore this email.</p>
   ```

   Set the subject of both to `Your Den sign-in code` and save each one.

7. Open **Project Settings > API** (or **API Keys**) and copy:
   - the **Project URL**
   - the **anon** key (newer projects call it the **publishable** key)
   - the **service_role** key (newer projects: **secret** key). Keep this one secret and never put it in code or share it.

### 2. Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com), create a project, then go to **APIs & Services > OAuth consent screen** and fill in the app name (Den) and your email.
2. Go to **Credentials > Create credentials > OAuth client ID**, choose **Web application**.
3. Under **Authorized redirect URIs** add: `https://YOUR-PROJECT.supabase.co/auth/v1/callback` (use your Supabase Project URL).
4. Copy the **Client ID** and **Client secret**, then in Supabase open **Authentication > Sign In / Providers > Google**, turn it on and paste both.

> **"Error 400: redirect_uri_mismatch" when signing in with Google?** Google's redirect URI doesn't exactly match Supabase's callback.
> 1. In Supabase open **Authentication > Sign In / Providers > Google** and copy the **Callback URL (for OAuth)** with its copy button.
> 2. In Google Cloud open **APIs & Services > Credentials**, click your OAuth client, and paste it under **Authorized redirect URIs** (not JavaScript origins). Save.
> 3. Wait about 5 minutes and try again in a private window.
>
> Don't put your Vercel link in Google's redirect URIs; it goes in Supabase's **URL Configuration**. On Google's error page, **see error details** shows the exact address that must be on the list.

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
   | `NEXT_PUBLIC_EMAIL_CODES` | `on` (set `off` to show Google sign-in only, e.g. while your email sender isn't working) |
   | `NEXT_PUBLIC_LEGAL_OPERATOR` | Your full name or company name (shown on policy pages) |
   | `NEXT_PUBLIC_LEGAL_CITY` | City, State |
   | `NEXT_PUBLIC_CONTACT_EMAIL` | Email for privacy requests |
   | `NEXT_PUBLIC_GRIEVANCE_OFFICER` | Grievance Officer's full name (required by India's IT Rules) |
   | `NEXT_PUBLIC_GRIEVANCE_EMAIL` | Email for complaints |

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

### 7. Student verification and Den Admin

Students who sign in with Gmail can only look around until they verify, in one of three ways: a code sent to their **college email**, a photo of their **student ID card** (read by AI, then checked by a person in Den Admin; the photo is deleted after), or **two verified classmates** vouching for them. Accounts that existed before you ran `0005_verification.sql` get 14 days to verify.

**In the Den project on Vercel, add these environment variables** (Settings → Environment Variables), then redeploy:

| Key | Value | Secret? |
|---|---|---|
| `SMTP_HOST` | `smtp-relay.brevo.com` | no |
| `SMTP_PORT` | `587` | no |
| `SMTP_USER` | your Brevo SMTP login (Brevo → SMTP & API → SMTP) | no |
| `SMTP_PASS` | your Brevo SMTP key | **yes** |
| `SMTP_FROM` | `Den <the Gmail you verified in Brevo>` | no |
| `CRON_SECRET` | any long random text (40+ letters and numbers) | **yes** |

Without the SMTP keys the "College email" option shows "isn't switched on yet"; the other two still work. `CRON_SECRET` lets the daily clean-up (in `vercel.json`) delete old ID card photos.

**Den Admin is a separate website** in the `admin/` folder. Students never see it. To put it online:

1. Vercel → **Add New → Project** → import the same `den` repository again.
2. Project name: `den-admin`. **Root Directory: `admin`** (click Edit next to it). Framework: Next.js.
3. Environment variables: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the same values as Den), `NEXT_PUBLIC_DEN_URL` = your Den address (e.g. `https://den-sable.vercel.app`), and optionally `ADMIN_EMAILS` = your Google email (only these emails can open Den Admin, as an extra lock).
4. Deploy. Then in Supabase → Authentication → URL Configuration → Redirect URLs, add `https://den-admin*.vercel.app/**` (and your admin domain later, e.g. `https://admin.joinden.in/**`).
5. Sign in with Google. Only accounts with `is_admin = true` get in (step 6 above). The database also refuses every admin action from anyone else.

Den Admin never uses the Supabase service key. Everything goes through admin-only database functions that check `is_admin`.

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

## Demo posts for testing

To see a busy feed, run `supabase/demo/add-demo-posts.sql` in the Supabase SQL Editor. It adds 12 demo students (emails ending in `@den-demo.ac.in`) to your college with 40 posts, comments, likes, a poll and 3 events. `supabase/demo/remove-demo-posts.sql` removes all of it again.

## Project documents

Den's overview and history, technical guide, design, testing and roadmap are Markdown files in `admin/content/docs/`. Den Admin shows them under **Docs**. Update them in the same branch as the change they describe.

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
