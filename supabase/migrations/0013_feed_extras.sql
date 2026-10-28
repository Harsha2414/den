-- Den: feed extras. Edit a post (first 15 minutes), hide a post, mute a person, polls,
-- a pinned post per college (admins), and "Top this week".
-- Run this once in the Supabase SQL Editor after 0012. Safe to run again.

-- =========================================================
-- 1. Edit your own post within 15 minutes
-- =========================================================
alter table public.posts add column if not exists edited_at timestamptz;
alter table public.posts add column if not exists pinned_at timestamptz;

create or replace function public.post_edit_rules()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Pinning goes through admin_pin_post; everything else here is a student editing their text.
  if new.body is distinct from old.body then
    if not public.is_admin() and old.created_at < now() - interval '15 minutes' then
      raise exception 'Posts can only be edited in the first 15 minutes.';
    end if;
    new.edited_at := now();
  end if;
  return new;
end $$;
drop trigger if exists post_edit_rules on public.posts;
create trigger post_edit_rules before update on public.posts for each row execute function public.post_edit_rules();

drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists posts_update_verified on public.posts;
create policy posts_update_verified on public.posts as restrictive for update to authenticated
  using (public.can_participate()) with check (public.can_participate());
revoke update on public.posts from authenticated;
grant update (body) on public.posts to authenticated;

-- =========================================================
-- 2. Hide a post, mute a person (private to you)
-- =========================================================
create table if not exists public.hidden_posts (
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  post_id uuid not null references public.posts on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create table if not exists public.muted_users (
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  muted_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, muted_id),
  check (user_id <> muted_id)
);
alter table public.hidden_posts enable row level security;
alter table public.muted_users enable row level security;
do $$
declare t text;
begin
  foreach t in array array['hidden_posts', 'muted_users'] loop
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format('create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_own', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- =========================================================
-- 3. Polls. Votes are private: everyone sees the totals, nobody sees who voted for what.
-- =========================================================
create or replace function public.valid_poll_options(o text[])
returns boolean language sql immutable as $$
  select array_length(o, 1) between 2 and 4
    and not exists (select 1 from unnest(o) x where char_length(btrim(x)) not between 1 and 60);
$$;

create table if not exists public.polls (
  post_id uuid primary key references public.posts on delete cascade,
  options text[] not null check (public.valid_poll_options(options)),
  closes_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.poll_votes (
  post_id uuid not null references public.polls on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  choice int not null check (choice between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists poll_votes_post_idx on public.poll_votes (post_id);
alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;

-- A poll is visible when its post is; only the post's author adds one.
drop policy if exists polls_read on public.polls;
create policy polls_read on public.polls for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists polls_insert on public.polls;
create policy polls_insert on public.polls for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()) and public.can_participate());

-- Your own vote only. Voting needs a verified account, a poll you can see, an option that exists, and an open poll.
create or replace function public.poll_vote_ok(p_post uuid, p_choice int)
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (select 1 from public.polls pl join public.posts p on p.id = pl.post_id
    where pl.post_id = p_post and p_choice < array_length(pl.options, 1) and (pl.closes_at is null or pl.closes_at > now()))
    and public.can_participate();
$$;
drop policy if exists poll_votes_read on public.poll_votes;
create policy poll_votes_read on public.poll_votes for select to authenticated using (user_id = auth.uid());
drop policy if exists poll_votes_insert on public.poll_votes;
create policy poll_votes_insert on public.poll_votes for insert to authenticated
  with check (user_id = auth.uid() and public.poll_vote_ok(post_id, choice));
drop policy if exists poll_votes_update on public.poll_votes;
create policy poll_votes_update on public.poll_votes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.poll_vote_ok(post_id, choice));
drop policy if exists poll_votes_delete on public.poll_votes;
create policy poll_votes_delete on public.poll_votes for delete to authenticated using (user_id = auth.uid());
revoke all on public.polls, public.poll_votes from anon;
grant select, insert on public.polls to authenticated;
grant select, insert, delete on public.poll_votes to authenticated;
grant update (choice) on public.poll_votes to authenticated;

-- Vote totals for polls the student can see.
create or replace function public.poll_results(p_posts uuid[])
returns table (post_id uuid, choice int, votes int)
language sql stable security definer set search_path = public as $$
  select v.post_id, v.choice, count(*)::int
  from public.poll_votes v join public.posts p on p.id = v.post_id
  where v.post_id = any (p_posts)
    and (p.visibility = 'india' or p.college_id = public.my_college() or public.is_admin())
  group by v.post_id, v.choice;
$$;
revoke all on function public.poll_results(uuid[]) from public, anon;
grant execute on function public.poll_results(uuid[]) to authenticated;

-- =========================================================
-- 4. One pinned post per college (Den admins)
-- =========================================================
create or replace function public.admin_pin_post(p_post uuid, p_pin boolean)
returns void language plpgsql security definer set search_path = public as $$
declare p record;
begin
  perform public.admin_only();
  select id, college_id, author_id into p from public.posts where id = p_post;
  if not found then raise exception 'Post not found.'; end if;
  if p_pin then
    update public.posts set pinned_at = null where college_id = p.college_id and pinned_at is not null and id <> p_post;
    update public.posts set pinned_at = now() where id = p_post;
  else
    update public.posts set pinned_at = null where id = p_post;
  end if;
  perform public.admin_log(case when p_pin then 'post_pinned' else 'post_unpinned' end, p.author_id, 'post ' || p_post);
end $$;
revoke all on function public.admin_pin_post(uuid, boolean) from public, anon;
grant execute on function public.admin_pin_post(uuid, boolean) to authenticated;
create index if not exists posts_pinned_idx on public.posts (college_id) where pinned_at is not null;

-- =========================================================
-- 5. Top this week: posts from the last 7 days with the most reactions and comments.
-- Runs with the student's own permissions, so it only ever ranks posts they can see.
-- =========================================================
create or replace function public.top_posts(p_scope text, p_kind text default '', p_offset int default 0, p_limit int default 20)
returns table (id uuid, score int)
language sql stable security invoker set search_path = public as $$
  select p.id,
    ((select count(*) from public.likes l where l.item_type = 'post' and l.item_id = p.id)
      + 2 * (select count(*) from public.comments c where c.post_id = p.id))::int as score
  from public.posts p
  where p.created_at > now() - interval '7 days'
    and (case when p_scope = 'india' then p.visibility = 'india' else p.college_id = p_scope end)
    and (coalesce(p_kind, '') = '' or p.kind = p_kind)
  order by score desc, p.created_at desc
  offset greatest(p_offset, 0) limit least(greatest(p_limit, 1), 50);
$$;
revoke all on function public.top_posts(text, text, int, int) from public, anon;
grant execute on function public.top_posts(text, text, int, int) to authenticated;
