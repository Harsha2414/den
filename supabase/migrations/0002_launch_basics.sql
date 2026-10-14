-- Den: launch basics (terms agreement and age confirmation)
-- Run this once in the Supabase SQL Editor. It is safe to run while the app is live.

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz;

-- Students may record their own agreement (on sign-up, or later from the agreement screen).
grant insert (terms_accepted_at) on public.profiles to authenticated;
grant update (terms_accepted_at) on public.profiles to authenticated;

-- Remove likes when the liked post, note, placement story or event is deleted
-- (including when its author deletes their account).
create or replace function public.delete_item_likes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.likes where item_id = old.id and item_type = tg_argv[0];
  return old;
end $$;

drop trigger if exists delete_likes on public.posts;
create trigger delete_likes after delete on public.posts for each row execute function public.delete_item_likes('post');
drop trigger if exists delete_likes on public.notes;
create trigger delete_likes after delete on public.notes for each row execute function public.delete_item_likes('note');
drop trigger if exists delete_likes on public.placements;
create trigger delete_likes after delete on public.placements for each row execute function public.delete_item_likes('placement');
drop trigger if exists delete_likes on public.events;
create trigger delete_likes after delete on public.events for each row execute function public.delete_item_likes('event');
