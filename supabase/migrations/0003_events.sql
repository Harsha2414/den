-- Den: event management (RSVP, organisers, tickets with QR check-in, updates)
-- Run this once in the Supabase SQL Editor. It is safe to run again and safe while the app is live.

-- ---------------------------------------------------------
-- 1. More details on events
-- ---------------------------------------------------------
alter table public.events
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists capacity int,
  add column if not exists tickets boolean not null default false,
  add column if not exists cancelled_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table public.events drop constraint if exists events_capacity_check;
alter table public.events add constraint events_capacity_check check (capacity is null or capacity between 1 and 100000);

alter table public.events drop constraint if exists events_kind_check;
alter table public.events add constraint events_kind_check
  check (kind in ('Fest','Hackathon','Workshop','Club recruitment','Sports','Cultural','Talk','Meetup','Other'));

-- ---------------------------------------------------------
-- 2. Co-organisers, RSVPs and updates
-- ---------------------------------------------------------
create table if not exists public.event_organisers (
  event_id uuid not null references public.events on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  added_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists public.event_rsvps (
  event_id uuid not null references public.events on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  status text not null check (status in ('going','interested')),
  -- Secret code shown as the QR ticket. Only the ticket holder (and check-in) can read it.
  ticket_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  checked_in_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists event_rsvps_user_idx on public.event_rsvps (user_id);

create table if not exists public.event_updates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists event_updates_event_idx on public.event_updates (event_id, created_at desc);

-- ---------------------------------------------------------
-- 3. Helper functions
-- ---------------------------------------------------------
create or replace function public.is_event_organiser(ev uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.events where id = ev and author_id = auth.uid())
      or exists (select 1 from public.event_organisers where event_id = ev and user_id = auth.uid());
$$;

-- Going / Interested. Respects the seat limit, cancelled and past events, and blocks.
create or replace function public.rsvp_event(ev uuid, choice text)
returns text language plpgsql security definer set search_path = public as $$
declare
  e public.events;
  me uuid := auth.uid();
  cur text;
  n int;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if choice not in ('going', 'interested') then raise exception 'Choose Going or Interested.'; end if;
  select * into e from public.events where id = ev for update;  -- one RSVP at a time per event, so seats can't oversell
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

-- Your own ticket code (only while you're going).
create or replace function public.my_ticket(ev uuid)
returns text language sql stable security definer set search_path = public as $$
  select ticket_code from public.event_rsvps where event_id = ev and user_id = auth.uid() and status = 'going';
$$;

-- Full guest list with check-in status, for organisers and admins only.
create or replace function public.event_attendees(ev uuid)
returns table (user_id uuid, name text, branch text, year text, college_id text, verified boolean,
               status text, checked_in_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_event_organiser(ev) or public.is_admin()) then
    raise exception 'Only this event''s organisers can see the guest list.';
  end if;
  return query
    select r.user_id, p.name, p.branch, p.year, p.college_id, p.verified, r.status, r.checked_in_at, r.created_at
    from public.event_rsvps r join public.profiles p on p.id = r.user_id
    where r.event_id = ev
    order by r.status, p.name;
end $$;

-- Scan a ticket at the door.
create or replace function public.check_in_ticket(ev uuid, code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if not public.is_event_organiser(ev) then raise exception 'Only this event''s organisers can check people in.'; end if;
  select x.event_id, x.user_id, x.status, x.checked_in_at, p.name, p.branch, p.year, e.title
    into r
    from public.event_rsvps x
    join public.profiles p on p.id = x.user_id
    join public.events e on e.id = x.event_id
    where x.ticket_code = upper(btrim(code));
  if not found then raise exception 'Ticket not found. Check the code and try again.'; end if;
  if r.event_id <> ev then raise exception 'This ticket is for a different event: %', r.title; end if;
  if r.status <> 'going' then raise exception '% is no longer going to this event.', r.name; end if;
  if r.checked_in_at is not null then
    return json_build_object('already', true, 'name', r.name, 'branch', r.branch, 'year', r.year, 'at', r.checked_in_at);
  end if;
  update public.event_rsvps set checked_in_at = now() where event_id = ev and user_id = r.user_id;
  return json_build_object('already', false, 'name', r.name, 'branch', r.branch, 'year', r.year, 'at', now());
end $$;

-- Check someone in by hand (forgot their phone) or undo a mistaken check-in.
drop function if exists public.set_check_in(uuid, uuid, boolean);
create or replace function public.set_check_in(ev uuid, who uuid, done boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_event_organiser(ev) then raise exception 'Only this event''s organisers can do that.'; end if;
  if done and not exists (select 1 from public.event_rsvps where event_id = ev and user_id = who and status = 'going') then
    raise exception 'Only students who are going can be checked in.';
  end if;
  update public.event_rsvps set checked_in_at = case when done then coalesce(checked_in_at, now()) end
    where event_id = ev and user_id = who;
end $$;

-- Co-organisers: the event's creator adds or removes them; a co-organiser can remove themselves.
create or replace function public.add_event_organiser(ev uuid, who uuid)
returns void language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select author_id into owner from public.events where id = ev;
  if owner is null then raise exception 'This event doesn''t exist anymore.'; end if;
  if owner <> auth.uid() and not public.is_admin() then raise exception 'Only the event''s creator can add co-organisers.'; end if;
  if who = owner then raise exception 'You''re already the organiser.'; end if;
  if public.is_blocked_between(owner, who) then raise exception 'You can''t add this student.'; end if;
  if (select count(*) from public.event_organisers where event_id = ev) >= 10 then
    raise exception 'An event can have up to 10 co-organisers.';
  end if;
  insert into public.event_organisers (event_id, user_id) values (ev, who) on conflict do nothing;
end $$;

create or replace function public.remove_event_organiser(ev uuid, who uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if who <> auth.uid()
     and not exists (select 1 from public.events where id = ev and author_id = auth.uid())
     and not public.is_admin() then
    raise exception 'Only the event''s creator can remove co-organisers.';
  end if;
  delete from public.event_organisers where event_id = ev and user_id = who;
end $$;

create or replace function public.touch_event()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists touch_event on public.events;
create trigger touch_event before update on public.events for each row execute function public.touch_event();

-- ---------------------------------------------------------
-- 4. Row-level security and column permissions
-- ---------------------------------------------------------
alter table public.event_organisers enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.event_updates enable row level security;

-- Organisers (creator and co-organisers) can edit or cancel the event.
drop policy if exists events_update on public.events;
create policy events_update on public.events for update to authenticated
  using (public.is_event_organiser(id)) with check (public.is_event_organiser(id));
revoke update on public.events from anon, authenticated;
grant update (title, kind, event_date, start_time, end_time, venue, link, details, capacity, tickets, cancelled_at)
  on public.events to authenticated;

drop policy if exists event_organisers_read on public.event_organisers;
create policy event_organisers_read on public.event_organisers for select to authenticated using (true);
revoke insert, update, delete on public.event_organisers from anon, authenticated;

-- Everyone signed in can see who's going; ticket codes and check-ins stay hidden.
drop policy if exists event_rsvps_read on public.event_rsvps;
create policy event_rsvps_read on public.event_rsvps for select to authenticated using (true);
drop policy if exists event_rsvps_delete on public.event_rsvps;
create policy event_rsvps_delete on public.event_rsvps for delete to authenticated using (user_id = auth.uid());
revoke all on public.event_rsvps from anon, authenticated;
grant select (event_id, user_id, status, created_at) on public.event_rsvps to authenticated;
grant delete on public.event_rsvps to authenticated;

drop policy if exists event_updates_read on public.event_updates;
create policy event_updates_read on public.event_updates for select to authenticated using (true);
drop policy if exists event_updates_insert on public.event_updates;
create policy event_updates_insert on public.event_updates for insert to authenticated
  with check (author_id = auth.uid() and public.is_event_organiser(event_id));
drop policy if exists event_updates_delete on public.event_updates;
create policy event_updates_delete on public.event_updates for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());
revoke update on public.event_updates from anon, authenticated;
revoke all on public.event_organisers, public.event_rsvps, public.event_updates from anon;

revoke execute on function public.rsvp_event(uuid, text), public.my_ticket(uuid), public.event_attendees(uuid),
  public.check_in_ticket(uuid, text), public.set_check_in(uuid, uuid, boolean), public.add_event_organiser(uuid, uuid),
  public.remove_event_organiser(uuid, uuid), public.is_event_organiser(uuid) from public, anon;
grant execute on function public.rsvp_event(uuid, text), public.my_ticket(uuid), public.event_attendees(uuid),
  public.check_in_ticket(uuid, text), public.set_check_in(uuid, uuid, boolean), public.add_event_organiser(uuid, uuid),
  public.remove_event_organiser(uuid, uuid), public.is_event_organiser(uuid) to authenticated;
