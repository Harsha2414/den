-- Den: articles (long-form writing with drafts, likes and comments)
-- Run this once in the Supabase SQL Editor after 0003_events.sql. Safe to run again and safe while the app is live.

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles on delete cascade,
  college_id text not null references public.colleges,
  visibility text not null default 'india' check (visibility in ('college','india')),
  topic text not null default 'Campus life'
    check (topic in ('Campus life','Careers','Tech','Exams & study','Opinion','Stories','Clubs','Other')),
  title text not null check (char_length(btrim(title)) between 1 and 150),
  subtitle text not null default '' check (char_length(subtitle) <= 220),
  body text not null default '' check (char_length(body) <= 40000),
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint articles_publish_length check (status = 'draft' or char_length(btrim(body)) >= 100)
);
create index if not exists articles_feed_idx on public.articles (status, published_at desc);
create index if not exists articles_college_idx on public.articles (college_id, published_at desc);
create index if not exists articles_author_idx on public.articles (author_id, updated_at desc);

create or replace function public.article_stamps()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    new.published_at := now();
  elsif new.status = 'draft' then
    new.published_at := null;
  end if;
  return new;
end $$;
drop trigger if exists article_stamps on public.articles;
create trigger article_stamps before insert or update on public.articles
  for each row execute function public.article_stamps();

create table if not exists public.article_comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists article_comments_idx on public.article_comments (article_id, created_at);

-- Likes and reports can point at articles too.
alter table public.likes drop constraint if exists likes_item_type_check;
alter table public.likes add constraint likes_item_type_check
  check (item_type in ('post','note','placement','event','article'));
drop trigger if exists delete_likes on public.articles;
create trigger delete_likes after delete on public.articles
  for each row execute function public.delete_item_likes('article');

alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('user','post','comment','note','placement','listing','event','message','space','article','article_comment'));

-- ---------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------
alter table public.articles enable row level security;
alter table public.article_comments enable row level security;

-- Published articles: All India ones for everyone, campus-only ones for that college. Drafts: only the writer.
drop policy if exists articles_read on public.articles;
create policy articles_read on public.articles for select to authenticated using (
  author_id = auth.uid()
  or public.is_admin()
  or (status = 'published' and (visibility = 'india' or college_id = public.my_college()))
);
drop policy if exists articles_insert on public.articles;
create policy articles_insert on public.articles for insert to authenticated
  with check (author_id = auth.uid() and college_id = public.my_college());
drop policy if exists articles_update on public.articles;
create policy articles_update on public.articles for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists articles_delete on public.articles;
create policy articles_delete on public.articles for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());
revoke update on public.articles from anon, authenticated;
grant update (title, subtitle, body, topic, visibility, status) on public.articles to authenticated;

-- Comments: on articles you can read (the policy below runs with your own access to articles).
drop policy if exists article_comments_read on public.article_comments;
create policy article_comments_read on public.article_comments for select to authenticated
  using (exists (select 1 from public.articles a where a.id = article_id));
drop policy if exists article_comments_insert on public.article_comments;
create policy article_comments_insert on public.article_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (select 1 from public.articles a where a.id = article_id and a.status = 'published'
                and not public.is_blocked_between(auth.uid(), a.author_id))
  );
drop policy if exists article_comments_delete on public.article_comments;
create policy article_comments_delete on public.article_comments for delete to authenticated
  using (
    author_id = auth.uid() or public.is_admin()
    or exists (select 1 from public.articles a where a.id = article_id and a.author_id = auth.uid())
  );
revoke update on public.article_comments from anon, authenticated;
revoke all on public.articles, public.article_comments from anon;
