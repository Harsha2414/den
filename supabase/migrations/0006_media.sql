-- Den: photos, videos and files in posts, Market, notes, events, articles and messages.
-- Run this once in the Supabase SQL Editor after 0005. Safe to run again.
--
-- Each attachment is stored as JSON: {"path": "...", "kind": "image|video|file", "name": "...", "size": 123, "mime": "...", "w": 0, "h": 0}
-- Files live in two storage buckets:
--   media: public links (posts, Market, notes, events, articles). Paths start with the uploader's id.
--   chat:  private; only members of the conversation can open them. Paths are <uploader id>/<conversation id>/<file>.

-- =========================================================
-- 1. Columns
-- =========================================================
create or replace function public.valid_media(m jsonb, max_items int)
returns boolean language sql immutable as $$
  select jsonb_typeof(m) = 'array' and jsonb_array_length(m) <= max_items
    and not exists (
      select 1 from jsonb_array_elements(m) e
      where jsonb_typeof(e) <> 'object'
         or coalesce(e->>'path', '') !~ '^[0-9a-f-]{36}/[A-Za-z0-9/_.-]{1,200}$'
         or coalesce(e->>'kind', '') not in ('image','video','file')
         or char_length(coalesce(e->>'name', '')) > 200
    );
$$;

alter table public.posts add column if not exists media jsonb not null default '[]'::jsonb;
alter table public.listings add column if not exists media jsonb not null default '[]'::jsonb;
alter table public.notes add column if not exists media jsonb not null default '[]'::jsonb;
alter table public.events add column if not exists media jsonb not null default '[]'::jsonb;    -- banner/poster
alter table public.articles add column if not exists cover jsonb not null default '[]'::jsonb;  -- cover image
alter table public.articles add column if not exists media jsonb not null default '[]'::jsonb;  -- attached files
alter table public.messages add column if not exists attachments jsonb not null default '[]'::jsonb;

alter table public.posts drop constraint if exists posts_media_check;
alter table public.posts add constraint posts_media_check check (public.valid_media(media, 4));
alter table public.listings drop constraint if exists listings_media_check;
alter table public.listings add constraint listings_media_check check (public.valid_media(media, 6));
alter table public.notes drop constraint if exists notes_media_check;
alter table public.notes add constraint notes_media_check check (public.valid_media(media, 3));
alter table public.events drop constraint if exists events_media_check;
alter table public.events add constraint events_media_check check (public.valid_media(media, 1));
alter table public.articles drop constraint if exists articles_cover_check;
alter table public.articles add constraint articles_cover_check check (public.valid_media(cover, 1));
alter table public.articles drop constraint if exists articles_media_check;
alter table public.articles add constraint articles_media_check check (public.valid_media(media, 10));
alter table public.messages drop constraint if exists messages_attachments_check;
alter table public.messages add constraint messages_attachments_check check (public.valid_media(attachments, 6));

-- A post or message can be just a photo, with no text.
alter table public.posts drop constraint if exists posts_body_check;
alter table public.posts add constraint posts_body_check
  check (char_length(body) <= 3000 and (char_length(btrim(body)) >= 1 or jsonb_array_length(media) > 0));
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages add constraint messages_body_check
  check (char_length(body) <= 4000 and (char_length(btrim(body)) >= 1 or jsonb_array_length(attachments) > 0));

-- Let authors edit their own media where they can already edit (events: organisers; articles: writer; listings: seller).
grant update (media) on public.events to authenticated;
grant update (cover, media) on public.articles to authenticated;
grant update (media) on public.listings to authenticated;

-- Chat list preview for photo/file-only messages.
create or replace function public.on_message_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare n int := jsonb_array_length(coalesce(new.attachments, '[]'::jsonb)); k text := new.attachments->0->>'kind';
begin
  update public.conversations
     set last_message_at = new.created_at,
         last_message_preview = left(case
           when btrim(new.body) <> '' then new.body
           when k = 'image' then case when n > 1 then n || ' photos' else 'Photo' end
           when k = 'video' then 'Video'
           else coalesce(new.attachments->0->>'name', 'File') end, 120),
         last_sender_id = new.sender_id
   where id = new.conversation_id;
  update public.conversation_members set last_read_at = new.created_at
   where conversation_id = new.conversation_id and user_id = new.sender_id;
  return new;
end $$;

-- =========================================================
-- 2. Storage buckets and who can do what
-- =========================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', true, 52428800, array[
    'image/jpeg','image/png','image/webp','image/gif',
    'video/mp4','video/quicktime','video/webm',
    'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain','text/csv','application/zip','application/x-zip-compressed']),
  ('chat', 'chat', false, 52428800, array[
    'image/jpeg','image/png','image/webp','image/gif',
    'video/mp4','video/quicktime','video/webm',
    'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain','text/csv','application/zip','application/x-zip-compressed'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- media: verified students upload into their own folder; anyone with the link can view; owner or admin deletes.
drop policy if exists "media: upload own" on storage.objects;
create policy "media: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text and public.can_participate());
-- (Viewing works through public links; this lets owners and admins see their own objects so they can delete them.)
drop policy if exists "media: see own" on storage.objects;
create policy "media: see own" on storage.objects for select to authenticated
  using (bucket_id = 'media' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "media: delete own" on storage.objects;
create policy "media: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- chat: only members of the conversation can upload (if they can send there) and open files.
create or replace function public.chat_path_conversation(p text)
returns uuid language plpgsql stable as $$
begin
  return ((storage.foldername(p))[2])::uuid;
exception when others then
  return null;
end $$;

drop policy if exists "chat: upload as member" on storage.objects;
create policy "chat: upload as member" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat' and (storage.foldername(name))[1] = auth.uid()::text
              and public.can_send(public.chat_path_conversation(name)) and public.can_participate());
drop policy if exists "chat: members read" on storage.objects;
create policy "chat: members read" on storage.objects for select to authenticated
  using (bucket_id = 'chat' and (public.is_member(public.chat_path_conversation(name)) or public.is_admin()));
drop policy if exists "chat: delete own" on storage.objects;
create policy "chat: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'chat' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- Admin report previews: say when a reported message only had a photo or file.
-- (admin_reports already shows message text; attachments show as "[attachment]" when there's no text.)
