-- Den database schema
-- Run this whole file once in the Supabase SQL editor (or with `supabase db push`).


-- =========================================================
-- Colleges and allowed email domains
-- =========================================================

create table public.colleges (
  id text primary key check (id ~ '^[a-z0-9-]{2,60}$'),
  name text not null check (char_length(name) between 2 and 120),
  city text not null default '' check (char_length(city) <= 60),
  -- Extra email domains for this college that don't end in .ac.in / .edu.in / .edu.
  -- Only an admin (Supabase dashboard) can change this list.
  email_domains text[] not null default '{}',
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

-- Extra domains accepted for email-code sign-in (add rows from the dashboard).
create table public.allowed_email_domains (
  domain text primary key check (domain = lower(domain))
);

-- Is this an academic email we accept for code sign-in?
create or replace function public.is_academic_email(p_email text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare d text := lower(split_part(coalesce(p_email, ''), '@', 2));
begin
  if d = '' then return false; end if;
  if d ~ '(^|\.)(ac\.in|edu\.in|edu)$' then return true; end if;
  if exists (select 1 from public.allowed_email_domains a where d = a.domain or d like '%.' || a.domain) then return true; end if;
  if exists (select 1 from public.colleges c where d = any (c.email_domains)) then return true; end if;
  return false;
end $$;

-- Lets the login page check an email before sending a code.
create or replace function public.check_signup_email(p_email text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_academic_email(p_email);
$$;
grant execute on function public.check_signup_email(text) to anon, authenticated;

-- Block email-code sign-ups from non-college addresses. Google sign-in is allowed for any account.
create or replace function public.enforce_college_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'provider', 'email') = 'email'
     and not public.is_academic_email(new.email) then
    raise exception 'Use your college email address, or sign in with Google.';
  end if;
  return new;
end $$;

create trigger enforce_college_email
  before insert on auth.users
  for each row execute function public.enforce_college_email();

-- =========================================================
-- Profiles
-- =========================================================

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  college_id text not null references public.colleges,
  branch text not null check (char_length(btrim(branch)) between 1 and 60),
  year text not null check (year in ('1st year','2nd year','3rd year','4th year','5th year','Postgrad','Alumni')),
  bio text not null default '' check (char_length(bio) <= 300),
  verified boolean not null default false,  -- set by trigger from the sign-in email
  is_admin boolean not null default false,  -- set from the Supabase dashboard only
  created_at timestamptz not null default now()
);

create or replace function public.set_profile_verified()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Students can't write verified or is_admin at all (see column permissions below).
  -- verified always follows the sign-in email; is_admin is set by you from the dashboard.
  new.verified := public.is_academic_email((select email from auth.users where id = new.id));
  return new;
end $$;

create trigger set_profile_verified
  before insert or update on public.profiles
  for each row execute function public.set_profile_verified();

create or replace function public.my_college()
returns text language sql stable security definer set search_path = public as $$
  select college_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- =========================================================
-- Campus content
-- =========================================================

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles on delete cascade,
  college_id text not null references public.colleges,
  visibility text not null default 'college' check (visibility in ('college','india')),
  kind text not null default 'General' check (kind in ('General','Doubt','Announcement','Lost & found','Hostel life')),
  body text not null check (char_length(btrim(body)) between 1 and 3000),
  created_at timestamptz not null default now()
);
create index on public.posts (college_id, created_at desc);
create index on public.posts (visibility, created_at desc);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index on public.comments (post_id, created_at);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles on delete cascade,
  college_id text not null references public.colleges,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  subject text not null check (char_length(btrim(subject)) between 1 and 80),
  kind text not null default 'Notes' check (kind in ('Notes','PYQ','Lab manual','Assignment','Book / PDF')),
  semester int not null check (semester between 1 and 10),
  branch text not null default '' check (char_length(branch) <= 60),
  link text not null default '' check (link = '' or link ~* '^https?://'),
  created_at timestamptz not null default now()
);
create index on public.notes (college_id, created_at desc);

create table public.placements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles on delete cascade,
  college_id text not null references public.colleges,
  company text not null check (char_length(btrim(company)) between 1 and 80),
  role text not null check (char_length(btrim(role)) between 1 and 80),
  ctc text not null default '' check (char_length(ctc) <= 40),
  result text not null default 'Selected' check (result in ('Selected','Rejected','In progress')),
  rounds text not null check (char_length(btrim(rounds)) between 1 and 4000),
  tips text not null default '' check (char_length(tips) <= 2000),
  created_at timestamptz not null default now()
);
create index on public.placements (college_id, created_at desc);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles on delete cascade,
  college_id text not null references public.colleges,
  item text not null check (char_length(btrim(item)) between 1 and 100),
  price int not null check (price between 0 and 10000000),
  condition text not null default 'Good' check (condition in ('Like new','Good','Used')),
  contact text not null check (char_length(btrim(contact)) between 1 and 120),
  details text not null default '' check (char_length(details) <= 1000),
  sold boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.listings (college_id, created_at desc);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles on delete cascade,
  college_id text not null references public.colleges,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  kind text not null default 'Fest' check (kind in ('Fest','Hackathon','Workshop','Club recruitment','Sports','Cultural')),
  event_date date not null,
  venue text not null default '' check (char_length(venue) <= 120),
  link text not null default '' check (link = '' or link ~* '^https?://'),
  details text not null default '' check (char_length(details) <= 2000),
  created_at timestamptz not null default now()
);
create index on public.events (college_id, event_date);

create table public.likes (
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  item_type text not null check (item_type in ('post','note','placement','event')),
  item_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);
create index on public.likes (item_type, item_id);

-- =========================================================
-- Safety: blocks and reports
-- =========================================================

create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles on delete cascade,
  blocked_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles on delete cascade,
  target_type text not null check (target_type in ('user','post','comment','note','placement','listing','event','message','space')),
  target_id text not null check (char_length(target_id) <= 100),
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  status text not null default 'open' check (status in ('open','reviewed','actioned')),
  created_at timestamptz not null default now()
);

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks
                 where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

-- =========================================================
-- Private messaging
-- =========================================================

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  title text not null default '' check (char_length(title) <= 80),
  created_by uuid references public.profiles on delete set null,
  dm_key text unique,  -- sorted pair of user ids for one-to-one chats
  last_message_at timestamptz not null default now(),
  last_message_preview text not null default '',
  last_sender_id uuid,
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  last_read_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index on public.conversation_members (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index on public.messages (conversation_id, created_at);

create or replace function public.is_member(conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_members where conversation_id = conv and user_id = auth.uid());
$$;

-- Can the current user send into this conversation? (member, and not blocked in a one-to-one chat)
create or replace function public.can_send(conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_member(conv) and not exists (
    select 1 from public.conversations c
    join public.conversation_members m on m.conversation_id = c.id and m.user_id <> auth.uid()
    where c.id = conv and not c.is_group and public.is_blocked_between(auth.uid(), m.user_id)
  );
$$;

create or replace function public.start_dm(other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  k text;
  cid uuid;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if other is null or other = me then raise exception 'Choose someone else to message.'; end if;
  if not exists (select 1 from public.profiles where id = other) then raise exception 'That student no longer exists.'; end if;
  if public.is_blocked_between(me, other) then raise exception 'You can''t message this student.'; end if;
  k := least(me::text, other::text) || ':' || greatest(me::text, other::text);
  select id into cid from public.conversations where dm_key = k;
  if cid is null then
    insert into public.conversations (is_group, created_by, dm_key) values (false, me, k) returning id into cid;
    insert into public.conversation_members (conversation_id, user_id) values (cid, me), (cid, other);
  end if;
  return cid;
end $$;

create or replace function public.create_group(p_title text, p_members uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  cid uuid;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if char_length(btrim(coalesce(p_title, ''))) = 0 then raise exception 'Give the group a name.'; end if;
  if coalesce(array_length(p_members, 1), 0) > 100 then raise exception 'Groups can have at most 100 members.'; end if;
  insert into public.conversations (is_group, title, created_by) values (true, btrim(p_title), me) returning id into cid;
  insert into public.conversation_members (conversation_id, user_id)
    select cid, u from (select distinct unnest(array_append(p_members, me)) as u) s
    where exists (select 1 from public.profiles p where p.id = s.u)
      and (s.u = me or not public.is_blocked_between(me, s.u));
  return cid;
end $$;

create or replace function public.add_group_members(conv uuid, p_members uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.conversations where id = conv and is_group) or not public.is_member(conv) then
    raise exception 'Only group members can add people.';
  end if;
  insert into public.conversation_members (conversation_id, user_id)
    select conv, u from unnest(p_members) u
    where exists (select 1 from public.profiles p where p.id = u)
      and not public.is_blocked_between(auth.uid(), u)
  on conflict do nothing;
end $$;

create or replace function public.leave_conversation(conv uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.conversation_members where conversation_id = conv and user_id = auth.uid();
$$;

create or replace function public.on_message_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
     set last_message_at = new.created_at,
         last_message_preview = left(new.body, 120),
         last_sender_id = new.sender_id
   where id = new.conversation_id;
  update public.conversation_members set last_read_at = new.created_at
   where conversation_id = new.conversation_id and user_id = new.sender_id;
  return new;
end $$;

create trigger on_message_insert after insert on public.messages
  for each row execute function public.on_message_insert();

-- =========================================================
-- Voice Spaces and live Debate Spaces
-- =========================================================

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null default auth.uid() references public.profiles on delete cascade,
  college_id text not null references public.colleges,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  visibility text not null default 'india' check (visibility in ('college','india')),
  mode text not null default 'space' check (mode in ('space','debate')),
  status text not null default 'scheduled' check (status in ('scheduled','live','ended')),
  scheduled_for timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  side_a text not null default 'For' check (char_length(btrim(side_a)) between 1 and 60),
  side_b text not null default 'Against' check (char_length(btrim(side_b)) between 1 and 60),
  round_index int not null default -1,      -- debate: -1 = not started
  round_ends_at timestamptz,
  rounds_total int not null default 7,       -- keep in sync with lib/debate.ts
  created_at timestamptz not null default now()
);
create index on public.spaces (status, created_at desc);

create table public.space_participants (
  space_id uuid not null references public.spaces on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  role text not null default 'listener' check (role in ('host','speaker','listener')),
  side text check (side in ('a','b')),
  hand_raised boolean not null default false,
  removed boolean not null default false,   -- removed by the host; can't rejoin this Space
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create table public.debate_votes (
  space_id uuid not null references public.spaces on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  phase text not null check (phase in ('before','after')),
  side text not null check (side in ('a','b')),
  created_at timestamptz not null default now(),
  primary key (space_id, user_id, phase)
);

create or replace function public.can_see_space(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.spaces s where s.id = sid
                 and (s.visibility = 'india' or s.college_id = public.my_college()));
$$;

create or replace function public.vote_open(sid uuid, p_phase text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.spaces s where s.id = sid and s.mode = 'debate' and (
      (p_phase = 'before' and s.status <> 'ended' and s.round_index <= 0) or
      (p_phase = 'after' and (s.status = 'ended' or s.round_index >= s.rounds_total - 1) and s.round_index >= 0)
    ));
$$;

create or replace function public.on_space_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.space_participants (space_id, user_id, role) values (new.id, new.host_id, 'host');
  return new;
end $$;

create trigger on_space_insert after insert on public.spaces
  for each row execute function public.on_space_insert();

-- =========================================================
-- AI helper usage (written by the server only)
-- =========================================================

create table public.ai_usage (
  user_id uuid not null references public.profiles on delete cascade,
  day date not null default (now() at time zone 'Asia/Kolkata')::date,
  count int not null default 0,
  primary key (user_id, day)
);

create or replace function public.bump_ai_usage(p_user uuid, p_limit int)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.ai_usage (user_id, day, count)
  values (p_user, (now() at time zone 'Asia/Kolkata')::date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count into n;
  if n > p_limit then
    update public.ai_usage set count = count - 1
     where user_id = p_user and day = (now() at time zone 'Asia/Kolkata')::date;
    return -1;
  end if;
  return n;
end $$;
revoke execute on function public.bump_ai_usage(uuid, int) from public, anon, authenticated;

-- =========================================================
-- Row-level security
-- =========================================================

alter table public.colleges enable row level security;
alter table public.allowed_email_domains enable row level security;
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.notes enable row level security;
alter table public.placements enable row level security;
alter table public.listings enable row level security;
alter table public.events enable row level security;
alter table public.likes enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.spaces enable row level security;
alter table public.space_participants enable row level security;
alter table public.debate_votes enable row level security;
alter table public.ai_usage enable row level security;

-- Colleges: anyone signed in reads; students can add a college (without email domains).
create policy colleges_read on public.colleges for select to authenticated using (true);
create policy colleges_add on public.colleges for insert to authenticated
  with check (created_by = auth.uid() and email_domains = '{}');

-- Profiles
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Posts: "My college" posts are visible only to that college; "All India" posts to everyone.
create policy posts_read on public.posts for select to authenticated
  using (visibility = 'india' or college_id = public.my_college() or public.is_admin());
create policy posts_insert on public.posts for insert to authenticated
  with check (author_id = auth.uid() and college_id = public.my_college());
create policy posts_delete on public.posts for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

create policy comments_read on public.comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
create policy comments_delete on public.comments for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- Notes, placements, listings, events: readable by all students, posted to your own college.
create policy notes_read on public.notes for select to authenticated using (true);
create policy notes_insert on public.notes for insert to authenticated
  with check (author_id = auth.uid() and college_id = public.my_college());
create policy notes_delete on public.notes for delete to authenticated using (author_id = auth.uid() or public.is_admin());

create policy placements_read on public.placements for select to authenticated using (true);
create policy placements_insert on public.placements for insert to authenticated
  with check (author_id = auth.uid() and college_id = public.my_college());
create policy placements_delete on public.placements for delete to authenticated using (author_id = auth.uid() or public.is_admin());

create policy listings_read on public.listings for select to authenticated using (true);
create policy listings_insert on public.listings for insert to authenticated
  with check (author_id = auth.uid() and college_id = public.my_college());
create policy listings_update on public.listings for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy listings_delete on public.listings for delete to authenticated using (author_id = auth.uid() or public.is_admin());

create policy events_read on public.events for select to authenticated using (true);
create policy events_insert on public.events for insert to authenticated
  with check (author_id = auth.uid() and college_id = public.my_college());
create policy events_delete on public.events for delete to authenticated using (author_id = auth.uid() or public.is_admin());

create policy likes_read on public.likes for select to authenticated using (true);
create policy likes_insert on public.likes for insert to authenticated with check (user_id = auth.uid());
create policy likes_delete on public.likes for delete to authenticated using (user_id = auth.uid());

-- Blocks: you see and manage only your own.
create policy blocks_read on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy blocks_insert on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy blocks_delete on public.blocks for delete to authenticated using (blocker_id = auth.uid());

-- Reports: you file them; only admins read them.
create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_read on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy reports_update on public.reports for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Messaging: only members can see a conversation and its messages.
create policy conv_read on public.conversations for select to authenticated using (public.is_member(id));
create policy conv_rename on public.conversations for update to authenticated
  using (is_group and public.is_member(id)) with check (is_group and public.is_member(id));
create policy convm_read on public.conversation_members for select to authenticated using (public.is_member(conversation_id));
create policy convm_update on public.conversation_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy msg_read on public.messages for select to authenticated using (public.is_member(conversation_id));
create policy msg_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.can_send(conversation_id));
create policy msg_delete on public.messages for delete to authenticated using (sender_id = auth.uid());

-- Spaces
create policy spaces_read on public.spaces for select to authenticated
  using (visibility = 'india' or college_id = public.my_college() or host_id = auth.uid());
create policy spaces_insert on public.spaces for insert to authenticated
  with check (host_id = auth.uid() and college_id = public.my_college() and status = 'scheduled' and round_index = -1);
create policy spaces_update on public.spaces for update to authenticated
  using (host_id = auth.uid() and status <> 'ended') with check (host_id = auth.uid());
create policy spaces_delete on public.spaces for delete to authenticated
  using ((host_id = auth.uid() and status <> 'live') or public.is_admin());

create policy sp_read on public.space_participants for select to authenticated using (public.can_see_space(space_id));
create policy sp_join on public.space_participants for insert to authenticated
  with check (user_id = auth.uid() and role = 'listener' and side is null and public.can_see_space(space_id)
              and exists (select 1 from public.spaces s where s.id = space_id and s.status <> 'ended'));
create policy sp_update_self on public.space_participants for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy sp_leave on public.space_participants for delete to authenticated
  using (user_id = auth.uid() and role <> 'host' and not removed);

create policy votes_read on public.debate_votes for select to authenticated using (public.can_see_space(space_id));
create policy votes_insert on public.debate_votes for insert to authenticated
  with check (user_id = auth.uid() and public.can_see_space(space_id) and public.vote_open(space_id, phase));
create policy votes_update on public.debate_votes for update to authenticated
  using (user_id = auth.uid() and public.vote_open(space_id, phase))
  with check (user_id = auth.uid() and public.vote_open(space_id, phase));

-- ai_usage: no policies, so only the server (service role) can touch it.

-- =========================================================
-- Column-level permissions (stop students editing protected fields)
-- =========================================================

revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, name, college_id, branch, year, bio) on public.profiles to authenticated;
grant update (name, college_id, branch, year, bio) on public.profiles to authenticated;

revoke update on public.listings from anon, authenticated;
grant update (sold, price, details) on public.listings to authenticated;

revoke update on public.conversations from anon, authenticated;
grant update (title) on public.conversations to authenticated;

revoke update on public.conversation_members from anon, authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;

-- Hosts may edit a space's text and schedule; going live, rounds and roles go through the server.
revoke update on public.spaces from anon, authenticated;
grant update (title, description, scheduled_for) on public.spaces to authenticated;

revoke update on public.space_participants from anon, authenticated;
grant update (hand_raised) on public.space_participants to authenticated;

revoke update on public.debate_votes from anon, authenticated;
grant update (side) on public.debate_votes to authenticated;

revoke update on public.reports from anon, authenticated;
grant update (status) on public.reports to authenticated;

revoke all on public.ai_usage from anon, authenticated;
revoke all on public.allowed_email_domains from anon, authenticated;

-- Signed-out visitors get nothing from the content tables.
revoke all on all tables in schema public from anon;

-- =========================================================
-- Live updates
-- =========================================================

alter publication supabase_realtime add table
  public.messages, public.conversations, public.conversation_members,
  public.spaces, public.space_participants, public.debate_votes;
