-- Den: student verification (college email, ID card, classmates), read-only mode for
-- unverified accounts, bans, and the functions behind the separate Den Admin site.
-- Run this once in the Supabase SQL Editor after 0004. Safe to run again.

-- =========================================================
-- 1. Profile fields
-- =========================================================
alter table public.profiles
  add column if not exists verified_via text,
  add column if not exists verified_at timestamptz,
  add column if not exists banned_at timestamptz;

alter table public.profiles drop constraint if exists profiles_verified_via_check;
alter table public.profiles add constraint profiles_verified_via_check
  check (verified_via is null or verified_via in ('email','college_email','id_card','classmates','admin'));

-- Admin-only notes about a student (never readable by students).
create table if not exists public.profile_admin (
  user_id uuid primary key references public.profiles on delete cascade,
  ban_reason text not null default '',
  vouch_blocked_until timestamptz,
  flag_cleared_at timestamptz
);

-- verified now comes from the sign-in email OR a completed verification.
-- Students can't write verified, verified_via or banned_at (column permissions), only these functions can.
create or replace function public.set_profile_verified()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_academic_email((select email from auth.users where id = new.id)) then
    new.verified := true;
    if new.verified_via is null then new.verified_via := 'email'; end if;
  else
    if new.verified_via = 'email' then new.verified_via := null; end if;
    new.verified := new.verified_via is not null;
  end if;
  if new.verified and new.verified_at is null then new.verified_at := now(); end if;
  if not new.verified then new.verified_at := null; end if;
  return new;
end $$;

-- Existing college-email students count as verified since they joined.
update public.profiles set verified_at = created_at where verified and verified_at is null;

-- =========================================================
-- 2. Read-only mode for unverified accounts
-- =========================================================
-- Existing accounts get a grace period (14 days from when this file is first run).
create table if not exists public.verify_settings (
  id boolean primary key default true check (id),
  grace_cutoff timestamptz not null,
  grace_until timestamptz not null
);
insert into public.verify_settings (id, grace_cutoff, grace_until) values (true, now(), now() + interval '14 days')
on conflict (id) do nothing;

create or replace function public.can_participate()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.banned_at is null and (p.verified or (p.created_at < s.grace_cutoff and now() < s.grace_until))
    from public.profiles p cross join public.verify_settings s
    where p.id = auth.uid()), false);
$$;

-- What the app shows: full, grace (until a date), read (needs to verify) or banned.
create or replace function public.my_access()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'level', case
      when p.banned_at is not null then 'banned'
      when p.verified then 'full'
      when p.created_at < s.grace_cutoff and now() < s.grace_until then 'grace'
      else 'read' end,
    'grace_until', s.grace_until)
  from public.profiles p cross join public.verify_settings s
  where p.id = auth.uid();
$$;

-- "Restrictive" policies are added on top of the existing ones: every write below now ALSO needs
-- a verified, non-banned student. Reading, reporting, blocking and editing your profile stay open.
do $$
declare
  t record;
begin
  for t in select * from (values
    ('posts','insert'), ('comments','insert'), ('notes','insert'), ('placements','insert'), ('listings','insert'),
    ('events','insert'), ('likes','insert'), ('messages','insert'), ('spaces','insert'), ('debate_votes','insert'),
    ('debate_votes','update'), ('articles','insert'), ('article_comments','insert'), ('event_updates','insert'),
    ('space_participants','update')
  ) as x(tbl, cmd) loop
    execute format('drop policy if exists %I on public.%I', t.tbl || '_' || t.cmd || '_verified', t.tbl);
    if t.cmd = 'insert' then
      execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (public.can_participate())',
        t.tbl || '_' || t.cmd || '_verified', t.tbl);
    else
      execute format('create policy %I on public.%I as restrictive for update to authenticated using (public.can_participate()) with check (public.can_participate())',
        t.tbl || '_' || t.cmd || '_verified', t.tbl);
    end if;
  end loop;
end $$;

-- RSVPs go through a function (which skips row-level security), so it checks too.
create or replace function public.rsvp_event(ev uuid, choice text)
returns text language plpgsql security definer set search_path = public as $$
declare
  e public.events;
  me uuid := auth.uid();
  cur text;
  n int;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if not public.can_participate() then raise exception 'Verify your student account to RSVP.'; end if;
  if choice not in ('going', 'interested') then raise exception 'Choose Going or Interested.'; end if;
  select * into e from public.events where id = ev for update;
  if not found then raise exception 'This event doesn''t exist anymore.'; end if;
  if e.cancelled_at is not null then raise exception 'This event was cancelled.'; end if;
  if e.event_date < (now() at time zone 'Asia/Kolkata')::date then raise exception 'This event is over.'; end if;
  if public.is_blocked_between(me, e.author_id) then raise exception 'You can''t join this event.'; end if;
  select status into cur from public.event_rsvps where event_id = ev and user_id = me;
  if choice = 'going' and coalesce(cur, '') <> 'going' and e.capacity is not null then
    select count(*) into n from public.event_rsvps where event_id = ev and status = 'going';
    if n >= e.capacity then raise exception 'Sorry, this event is full.'; end if;
  end if;
  insert into public.event_rsvps (event_id, user_id, status) values (ev, me, choice)
  on conflict (event_id, user_id) do update set status = excluded.status;
  return choice;
end $$;

-- =========================================================
-- 3. College email verification (codes are sent by the app's server)
-- =========================================================
create table if not exists public.email_codes (
  user_id uuid primary key references public.profiles on delete cascade,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  sends int not null default 1,
  last_sent_at timestamptz not null default now()
);
create table if not exists public.verified_college_emails (
  email text primary key check (email = lower(email)),
  user_id uuid not null unique references public.profiles on delete cascade,
  college_id text not null references public.colleges,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 4. ID card checks
-- =========================================================
create table if not exists public.id_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  college_id text not null references public.colleges,
  name_on_card text not null default '' check (char_length(name_on_card) <= 80),
  photo_path text,
  ai_verdict text not null check (ai_verdict in ('match','unclear','mismatch','error')),
  ai_reading jsonb not null default '{}'::jsonb,
  card_fingerprint text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reject_reason text not null default '',
  reviewed_by uuid references public.profiles on delete set null,
  reviewed_at timestamptz,
  photo_deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists id_checks_queue_idx on public.id_checks (status, created_at);
create index if not exists id_checks_user_idx on public.id_checks (user_id, created_at desc);
-- The same card can't verify two different accounts.
create unique index if not exists id_checks_card_once on public.id_checks (card_fingerprint)
  where card_fingerprint is not null and status <> 'rejected';

-- Private storage for card photos: a student can upload into their own folder; only admins can view or delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('id-cards', 'id-cards', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists "id cards: upload own" on storage.objects;
create policy "id cards: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'id-cards' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "id cards: admins view" on storage.objects;
create policy "id cards: admins view" on storage.objects for select to authenticated
  using (bucket_id = 'id-cards' and public.is_admin());
drop policy if exists "id cards: admins delete" on storage.objects;
create policy "id cards: admins delete" on storage.objects for delete to authenticated
  using (bucket_id = 'id-cards' and public.is_admin());

-- =========================================================
-- 5. Classmates vouching
-- =========================================================
create table if not exists public.vouches (
  requester_id uuid not null references public.profiles on delete cascade,
  voucher_id uuid not null references public.profiles on delete cascade,
  status text not null default 'pending' check (status in ('pending','yes','no','unsure')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  primary key (requester_id, voucher_id)
);
create index if not exists vouches_voucher_idx on public.vouches (voucher_id, status);

-- Can I vouch right now? (verified 7+ days, not banned, not blocked from vouching)
create or replace function public.can_vouch(who uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.verified and p.banned_at is null
      and coalesce(p.verified_at, p.created_at) <= now() - interval '7 days'
      and coalesce((select a.vouch_blocked_until from public.profile_admin a where a.user_id = p.id), '-infinity') < now()
    from public.profiles p where p.id = who), false);
$$;

create or replace function public.request_vouch(voucher uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me public.profiles; v public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  select * into v from public.profiles where id = voucher;
  if me.id is null or v.id is null then raise exception 'Student not found.'; end if;
  if me.verified then raise exception 'You''re already verified.'; end if;
  if me.banned_at is not null then raise exception 'Your account is suspended.'; end if;
  if v.id = me.id then raise exception 'Ask someone else.'; end if;
  if v.college_id <> me.college_id then raise exception 'Ask a classmate from your own college.'; end if;
  if not public.can_vouch(v.id) then raise exception '% can''t vouch yet. Ask a classmate who has been verified for at least a week.', v.name; end if;
  if public.is_blocked_between(me.id, v.id) then raise exception 'You can''t ask this student.'; end if;
  if (select count(*) from public.vouches where requester_id = me.id and status = 'pending') >= 3 then
    raise exception 'You can have 3 requests waiting at a time.';
  end if;
  insert into public.vouches (requester_id, voucher_id) values (me.id, v.id) on conflict do nothing;
end $$;

-- A classmate answers (from a request, or from a shared link). Two "yes" verify; two "no" flag for admins.
create or replace function public.answer_vouch(requester uuid, answer text)
returns json language plpgsql security definer set search_path = public as $$
declare me public.profiles; r public.profiles; yes_n int; no_n int;
begin
  if answer not in ('yes','no','unsure') then raise exception 'Choose yes, no or not sure.'; end if;
  select * into me from public.profiles where id = auth.uid();
  select * into r from public.profiles where id = requester;
  if r.id is null then raise exception 'Student not found.'; end if;
  if r.id = me.id then raise exception 'You can''t vouch for yourself.'; end if;
  if r.college_id <> me.college_id then raise exception 'You can only vouch for students at your own college.'; end if;
  if not public.can_vouch(me.id) then raise exception 'You can vouch once you''ve been verified for a week.'; end if;
  if answer = 'yes' and (select count(*) from public.vouches where voucher_id = me.id and status = 'yes'
       and answered_at > now() - interval '30 days') >= 5 then
    raise exception 'You can vouch for up to 5 students a month.';
  end if;
  insert into public.vouches (requester_id, voucher_id, status, answered_at) values (r.id, me.id, answer, now())
  on conflict (requester_id, voucher_id) do update set status = excluded.status, answered_at = now();
  select count(*) filter (where status = 'yes'), count(*) filter (where status = 'no') into yes_n, no_n
    from public.vouches where requester_id = r.id;
  if yes_n >= 2 and not r.verified and r.banned_at is null then
    update public.profiles set verified_via = 'classmates' where id = r.id;
  end if;
  return json_build_object('yes', yes_n, 'no', no_n);
end $$;

-- =========================================================
-- 6. Admin log
-- =========================================================
create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles on delete set null,
  action text not null,
  target_user uuid references public.profiles on delete set null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists admin_actions_idx on public.admin_actions (created_at desc);

create or replace function public.admin_only()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
end $$;

create or replace function public.admin_log(p_action text, p_user uuid, p_note text default '')
returns void language sql security definer set search_path = public as $$
  insert into public.admin_actions (admin_id, action, target_user, note) values (auth.uid(), p_action, p_user, coalesce(p_note, ''));
$$;

-- =========================================================
-- 7. Admin functions (used only by the Den Admin site)
-- =========================================================
create or replace function public.admin_overview()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_only();
  return json_build_object(
    'students', (select count(*) from public.profiles),
    'verified', (select count(*) from public.profiles where verified),
    'new_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'new_today', (select count(*) from public.profiles where created_at > date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'),
    'colleges_active', (select count(distinct college_id) from public.profiles),
    'banned', (select count(*) from public.profiles where banned_at is not null),
    'cards_waiting', (select count(*) from public.id_checks where status = 'pending'),
    'cards_unclear', (select count(*) from public.id_checks where status = 'pending' and ai_verdict <> 'match'),
    'flags_waiting', (select count(*) from public.admin_vouch_flags()),
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'posts_7d', (select count(*) from public.posts where created_at > now() - interval '7 days'),
    'by_method', (select coalesce(json_object_agg(m, n), '{}'::json) from
                   (select coalesce(verified_via, 'none') m, count(*) n from public.profiles group by 1) x),
    'top_colleges', (select coalesce(json_agg(x), '[]'::json) from
                   (select c.name, count(*) n from public.profiles p join public.colleges c on c.id = p.college_id
                    group by c.name order by n desc limit 8) x)
  );
end $$;

create or replace function public.admin_user_emails(ids uuid[])
returns table (id uuid, email text) language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_only();
  return query select u.id, u.email::text from auth.users u where u.id = any(ids);
end $$;

create or replace function public.admin_review_id(check_id uuid, approve boolean, reason text default '')
returns void language plpgsql security definer set search_path = public as $$
declare c public.id_checks;
begin
  perform public.admin_only();
  select * into c from public.id_checks where id = check_id for update;
  if c.id is null then raise exception 'Not found.'; end if;
  update public.id_checks set status = case when approve then 'approved' else 'rejected' end,
    reject_reason = case when approve then '' else coalesce(reason, '') end,
    reviewed_by = auth.uid(), reviewed_at = now()
  where id = check_id;
  if approve then
    update public.profiles set verified_via = coalesce(verified_via, 'id_card') where id = c.user_id;
  else
    update public.profiles set verified_via = null where id = c.user_id and verified_via = 'id_card';
  end if;
  perform public.admin_log(case when approve then 'id_approved' else 'id_rejected' end, c.user_id, reason);
end $$;

create or replace function public.admin_photo_deleted(check_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_only();
  update public.id_checks set photo_deleted_at = now(), photo_path = null where id = check_id;
end $$;

-- Accounts where two or more classmates said "No".
create or replace function public.admin_vouch_flags()
returns table (user_id uuid, no_count bigint, yes_count bigint, last_answer timestamptz)
language sql stable security definer set search_path = public as $$
  select v.requester_id, count(*) filter (where v.status = 'no'), count(*) filter (where v.status = 'yes'), max(v.answered_at)
  from public.vouches v
  join public.profiles p on p.id = v.requester_id
  left join public.profile_admin a on a.user_id = v.requester_id
  where public.is_admin() and p.banned_at is null
  group by v.requester_id, a.flag_cleared_at
  having count(*) filter (where v.status = 'no' and (a.flag_cleared_at is null or v.answered_at > a.flag_cleared_at)) >= 2;
$$;

create or replace function public.admin_clear_flag(who uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_only();
  insert into public.profile_admin (user_id, flag_cleared_at) values (who, now())
  on conflict (user_id) do update set flag_cleared_at = now();
  perform public.admin_log('flag_cleared', who);
end $$;

create or replace function public.admin_set_verified(who uuid, on_ boolean)
returns void language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  perform public.admin_only();
  select * into p from public.profiles where id = who;
  if p.id is null then raise exception 'Student not found.'; end if;
  if not on_ and p.verified_via = 'email' then
    raise exception 'This student signs in with a college email, so the tick comes from that. Ban the account instead.';
  end if;
  update public.profiles set verified_via = case when on_ then coalesce(verified_via, 'admin') else null end where id = who;
  perform public.admin_log(case when on_ then 'tick_given' else 'tick_removed' end, who);
end $$;

-- Ban. If the account was fake, classmates who vouched "yes" can't vouch for 90 days.
create or replace function public.admin_ban(who uuid, reason text, fake boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_only();
  if who = auth.uid() then raise exception 'You can''t ban yourself.'; end if;
  update public.profiles set banned_at = now(),
    verified_via = case when verified_via = 'email' then verified_via else null end
  where id = who;
  insert into public.profile_admin (user_id, ban_reason) values (who, coalesce(reason, ''))
  on conflict (user_id) do update set ban_reason = excluded.ban_reason;
  if fake then
    insert into public.profile_admin (user_id, vouch_blocked_until)
      select v.voucher_id, now() + interval '90 days' from public.vouches v where v.requester_id = who and v.status = 'yes'
    on conflict (user_id) do update set vouch_blocked_until = excluded.vouch_blocked_until;
  end if;
  perform public.admin_log(case when fake then 'banned_fake' else 'banned' end, who, reason);
end $$;

create or replace function public.admin_unban(who uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_only();
  update public.profiles set banned_at = null where id = who;
  perform public.admin_log('unbanned', who);
end $$;

-- Delete any reported thing.
create or replace function public.admin_delete_content(kind text, target text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_only();
  case kind
    when 'post' then delete from public.posts where id::text = target;
    when 'comment' then delete from public.comments where id::text = target;
    when 'note' then delete from public.notes where id::text = target;
    when 'placement' then delete from public.placements where id::text = target;
    when 'listing' then delete from public.listings where id::text = target;
    when 'event' then delete from public.events where id::text = target;
    when 'message' then delete from public.messages where id::text = target;
    when 'space' then delete from public.spaces where id::text = target;
    when 'article' then delete from public.articles where id::text = target;
    when 'article_comment' then delete from public.article_comments where id::text = target;
    else raise exception 'Can''t delete a %.', kind;
  end case;
end $$;

-- Reports with a short preview of what was reported and who wrote it.
create or replace function public.admin_reports(only_open boolean default true)
returns table (id uuid, target_type text, target_id text, reason text, status text, created_at timestamptz,
               reporter_id uuid, reporter_name text, author_id uuid, author_name text, preview text, gone boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_only();
  return query
  select r.id, r.target_type, r.target_id, r.reason, r.status, r.created_at,
    r.reporter_id, rp.name, x.aid, ap.name, left(x.pv, 280), x.aid is null
  from public.reports r
  left join lateral (
      select q.author_id as aid, q.body as pv from public.posts q where r.target_type = 'post' and q.id::text = r.target_id
      union all select q.author_id as aid, q.body as pv from public.comments q where r.target_type = 'comment' and q.id::text = r.target_id
      union all select q.author_id as aid, q.title || ' · ' || q.subject as pv from public.notes q where r.target_type = 'note' and q.id::text = r.target_id
      union all select q.author_id as aid, q.company || ': ' || q.rounds as pv from public.placements q where r.target_type = 'placement' and q.id::text = r.target_id
      union all select q.author_id as aid, q.item || ' · ' || q.details as pv from public.listings q where r.target_type = 'listing' and q.id::text = r.target_id
      union all select q.author_id as aid, q.title || ' · ' || q.details as pv from public.events q where r.target_type = 'event' and q.id::text = r.target_id
      union all select q.sender_id as aid, q.body as pv from public.messages q where r.target_type = 'message' and q.id::text = r.target_id
      union all select q.host_id as aid, q.title as pv from public.spaces q where r.target_type = 'space' and q.id::text = r.target_id
      union all select q.author_id as aid, q.title || ' · ' || q.subtitle as pv from public.articles q where r.target_type = 'article' and q.id::text = r.target_id
      union all select q.author_id as aid, q.body as pv from public.article_comments q where r.target_type = 'article_comment' and q.id::text = r.target_id
      union all select q.id as aid, q.name || ' · ' || q.branch || ', ' || q.year as pv from public.profiles q where r.target_type = 'user' and q.id::text = r.target_id
      limit 1
  ) x on true
  left join public.profiles rp on rp.id = r.reporter_id
  left join public.profiles ap on ap.id = x.aid
  where (not only_open or r.status = 'open')
  order by r.created_at desc
  limit 200;
end $$;

create or replace function public.admin_resolve_report(report uuid, remove boolean)
returns void language plpgsql security definer set search_path = public as $$
declare r public.reports;
begin
  perform public.admin_only();
  select * into r from public.reports where id = report;
  if r.id is null then raise exception 'Report not found.'; end if;
  if remove and r.target_type <> 'user' then perform public.admin_delete_content(r.target_type, r.target_id); end if;
  -- Close every open report about the same thing.
  update public.reports set status = case when remove then 'actioned' else 'reviewed' end
  where target_type = r.target_type and target_id = r.target_id and status = 'open';
  perform public.admin_log(case when remove then 'report_removed' else 'report_dismissed' end, null, r.target_type || ' ' || r.target_id);
end $$;

-- Students tab: search by name or email, with the details admins need.
create or replace function public.admin_find_students(q text default '', filter text default 'all')
returns table (id uuid, name text, email text, college_id text, branch text, year text, verified boolean,
               verified_via text, verified_at timestamptz, banned_at timestamptz, ban_reason text, created_at timestamptz,
               posts bigint, reports_against bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_only();
  return query
  select p.id, p.name, u.email::text, p.college_id, p.branch, p.year, p.verified, p.verified_via, p.verified_at,
    p.banned_at, coalesce(a.ban_reason, ''), p.created_at,
    (select count(*) from public.posts x where x.author_id = p.id),
    (select count(*) from public.reports r where r.target_type = 'user' and r.target_id = p.id::text)
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.profile_admin a on a.user_id = p.id
  where (coalesce(q, '') = '' or p.name ilike '%' || q || '%' or u.email ilike '%' || q || '%')
    and (filter = 'all' or (filter = 'unverified' and not p.verified and p.banned_at is null)
         or (filter = 'verified' and p.verified) or (filter = 'banned' and p.banned_at is not null))
  order by p.created_at desc
  limit 100;
end $$;

-- =========================================================
-- 8. Row-level security
-- =========================================================
alter table public.profile_admin enable row level security;
alter table public.verify_settings enable row level security;
alter table public.email_codes enable row level security;
alter table public.verified_college_emails enable row level security;
alter table public.id_checks enable row level security;
alter table public.vouches enable row level security;
alter table public.admin_actions enable row level security;

drop policy if exists profile_admin_read on public.profile_admin;
create policy profile_admin_read on public.profile_admin for select to authenticated using (public.is_admin());
drop policy if exists verify_settings_read on public.verify_settings;
create policy verify_settings_read on public.verify_settings for select to authenticated using (true);
-- email_codes and verified_college_emails: only the app's server (service key) touches them. No policies.
drop policy if exists id_checks_read on public.id_checks;
create policy id_checks_read on public.id_checks for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists vouches_read on public.vouches;
create policy vouches_read on public.vouches for select to authenticated
  using (requester_id = auth.uid() or voucher_id = auth.uid() or public.is_admin());
drop policy if exists vouches_delete on public.vouches;
create policy vouches_delete on public.vouches for delete to authenticated using (requester_id = auth.uid() and status = 'pending');
drop policy if exists admin_actions_read on public.admin_actions;
create policy admin_actions_read on public.admin_actions for select to authenticated using (public.is_admin());

revoke all on public.profile_admin, public.verify_settings, public.email_codes, public.verified_college_emails,
  public.id_checks, public.vouches, public.admin_actions from anon;
revoke insert, update, delete on public.profile_admin, public.verify_settings, public.email_codes,
  public.verified_college_emails, public.id_checks, public.admin_actions from authenticated;
revoke insert, update on public.vouches from authenticated;
revoke select on public.email_codes, public.verified_college_emails from authenticated;

-- Students can't change their own verification or ban status (profiles already limits columns; restate for clarity).
revoke update (verified_via, verified_at, banned_at) on public.profiles from authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'admin_overview()', 'admin_user_emails(uuid[])', 'admin_review_id(uuid, boolean, text)', 'admin_photo_deleted(uuid)',
    'admin_vouch_flags()', 'admin_clear_flag(uuid)', 'admin_set_verified(uuid, boolean)', 'admin_ban(uuid, text, boolean)',
    'admin_unban(uuid)', 'admin_delete_content(text, text)', 'admin_reports(boolean)', 'admin_resolve_report(uuid, boolean)',
    'admin_find_students(text, text)', 'request_vouch(uuid)', 'answer_vouch(uuid, text)', 'can_vouch(uuid)',
    'can_participate()', 'my_access()', 'admin_only()', 'admin_log(text, uuid, text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
-- admin_log is internal only.
revoke execute on function public.admin_log(text, uuid, text) from authenticated;
