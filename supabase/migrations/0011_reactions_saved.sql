-- Den: reactions on posts (long-press the heart) and saved posts.
-- Run this once in the Supabase SQL Editor after 0010. Safe to run again.

-- 1. Reactions. A like now has a reaction; every existing like stays a heart.
alter table public.likes add column if not exists reaction text not null default 'heart';
alter table public.likes drop constraint if exists likes_reaction_check;
alter table public.likes add constraint likes_reaction_check
  check (reaction in ('heart','laugh','wow','sad','fire','clap'));

-- Students can change their own reaction (verified students only, like every other action).
drop policy if exists likes_update on public.likes;
create policy likes_update on public.likes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists likes_update_verified on public.likes;
create policy likes_update_verified on public.likes as restrictive for update to authenticated
  using (public.can_participate()) with check (public.can_participate());
revoke update on public.likes from authenticated;
grant update (reaction) on public.likes to authenticated;

-- 2. Saved posts. Private: only the student who saved a post can see that they saved it.
create table if not exists public.saved_posts (
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  post_id uuid not null references public.posts on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index if not exists saved_posts_user_idx on public.saved_posts (user_id, created_at desc);
alter table public.saved_posts enable row level security;

drop policy if exists saved_read on public.saved_posts;
create policy saved_read on public.saved_posts for select to authenticated using (user_id = auth.uid());
drop policy if exists saved_insert on public.saved_posts;
create policy saved_insert on public.saved_posts for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists saved_delete on public.saved_posts;
create policy saved_delete on public.saved_posts for delete to authenticated using (user_id = auth.uid());

revoke all on public.saved_posts from anon;
grant select, insert, delete on public.saved_posts to authenticated;
