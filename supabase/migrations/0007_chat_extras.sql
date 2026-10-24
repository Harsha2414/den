-- Den: emoji reactions on messages (typing and online status need no tables; they use live presence).
-- Run this once in the Supabase SQL Editor after 0006. Safe to run again.

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index if not exists message_reactions_msg_idx on public.message_reactions (message_id);

-- Which conversation a message is in (used by the rules below).
create or replace function public.message_conversation(msg uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select conversation_id from public.messages where id = msg;
$$;

alter table public.message_reactions enable row level security;

drop policy if exists reactions_read on public.message_reactions;
create policy reactions_read on public.message_reactions for select to authenticated
  using (public.is_member(public.message_conversation(message_id)));
drop policy if exists reactions_insert on public.message_reactions;
create policy reactions_insert on public.message_reactions for insert to authenticated
  with check (user_id = auth.uid() and public.can_send(public.message_conversation(message_id)) and public.can_participate());
drop policy if exists reactions_delete on public.message_reactions;
create policy reactions_delete on public.message_reactions for delete to authenticated
  using (user_id = auth.uid());

revoke update on public.message_reactions from anon, authenticated;
revoke all on public.message_reactions from anon;
revoke execute on function public.message_conversation(uuid) from public, anon;
grant execute on function public.message_conversation(uuid) to authenticated;

-- Live updates for reactions (and so other members see them appear).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'message_reactions') then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;
