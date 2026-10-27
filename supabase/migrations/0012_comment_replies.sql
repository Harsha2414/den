-- Den: replies to comments. A reply sits under the comment it answers and names the person it replies to.
-- Replies are one level deep (like Instagram): replying to a reply joins the same thread.
-- Run this once in the Supabase SQL Editor after 0011. Safe to run again.

alter table public.comments
  add column if not exists parent_id uuid references public.comments on delete cascade,
  add column if not exists reply_to uuid references public.profiles on delete set null;
create index if not exists comments_parent_idx on public.comments (parent_id);

create or replace function public.comment_reply_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare p record;
begin
  if new.parent_id is null then new.reply_to := null; return new; end if;
  select post_id, parent_id, author_id into p from public.comments where id = new.parent_id;
  if not found or p.post_id <> new.post_id then
    raise exception 'That comment is not on this post.';
  end if;
  -- Replying to a reply: keep it in the same thread, under the first comment.
  -- The reply always names the author of the comment being answered (never someone the app chose).
  new.reply_to := p.author_id;
  if p.parent_id is not null then new.parent_id := p.parent_id; end if;
  return new;
end $$;

drop trigger if exists comment_reply_rules on public.comments;
create trigger comment_reply_rules before insert on public.comments
  for each row execute function public.comment_reply_rules();
