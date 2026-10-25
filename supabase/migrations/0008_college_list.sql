-- Den: every college in India (from AISHE), a fast college search, and tools to review colleges students add.
-- Run this once in the Supabase SQL Editor after 0007. Safe to run again and safe while the app is live.
-- After running it, open Den Admin → Colleges → "Import the India list" to load the ~70,000 colleges.

create extension if not exists pg_trgm with schema extensions;

-- 1. New college details ---------------------------------------------------------------
alter table public.colleges add column if not exists aishe_code text;
alter table public.colleges add column if not exists state text not null default '';
alter table public.colleges add column if not exists kind text not null default 'student';
alter table public.colleges add column if not exists aliases text[] not null default '{}';
alter table public.colleges add column if not exists featured boolean not null default false;
-- Colleges students add themselves start unreviewed; an admin marks them right or merges them.
alter table public.colleges add column if not exists reviewed boolean not null default false;
alter table public.colleges add column if not exists search_text text not null default '';
alter table public.colleges add column if not exists name_key text not null default '';

do $$ begin
  alter table public.colleges add constraint colleges_kind_check check (kind in ('university','college','standalone','student'));
exception when duplicate_object then null; end $$;
-- AISHE names can be long ("… College of Arts, Science and Commerce, Taluka …").
alter table public.colleges drop constraint if exists colleges_name_check;
do $$ begin
  alter table public.colleges add constraint colleges_name_len check (char_length(name) between 2 and 200);
exception when duplicate_object then null; end $$;
create unique index if not exists colleges_aishe_code_key on public.colleges (aishe_code) where aishe_code is not null;
create index if not exists colleges_name_key_idx on public.colleges (name_key);
create index if not exists colleges_search_trgm on public.colleges using gin (search_text extensions.gin_trgm_ops);
create index if not exists colleges_aliases_idx on public.colleges using gin (aliases);
create index if not exists profiles_college_idx on public.profiles (college_id);

-- Keep the search text and the duplicate-check key up to date.
create or replace function public.college_search_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  new.name_key := regexp_replace(lower(new.name), '[^a-z0-9]+', '', 'g');
  -- Name with and without punctuation, place, short names, and common short forms students type.
  new.search_text := lower(concat_ws(' ', new.name, regexp_replace(new.name, '[^A-Za-z0-9 ]+', '', 'g'), new.city, new.state,
    array_to_string(new.aliases, ' '),
    case when new.name ~* 'government' then 'govt' end, case when new.name ~* 'engineering' then 'engg' end,
    case when new.name ~* '\msaint\M' then 'st' end, case when new.name ~* 'technology' then 'tech' end));
  return new;
end $$;
drop trigger if exists colleges_search_fields on public.colleges;
create trigger colleges_search_fields before insert or update of name, city, state, aliases on public.colleges
  for each row execute function public.college_search_fields();
update public.colleges set name = name where search_text = '' or name_key = '';

-- A college added by a student is always marked as student-added and unreviewed.
create or replace function public.college_added_by_student()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.kind := 'student'; new.aishe_code := null; new.featured := false; new.reviewed := false; new.aliases := '{}';
  end if;
  return new;
end $$;
drop trigger if exists colleges_added_by_student on public.colleges;
create trigger colleges_added_by_student before insert on public.colleges
  for each row execute function public.college_added_by_student();

-- 2. Search (works before sign-in too, for the landing page) ----------------------------
create or replace function public.search_colleges(q text, lim int default 10)
returns table (id text, name text, city text, state text, kind text, students int)
language sql stable security definer set search_path = public, extensions as $$
  with s as (
    select lower(trim(regexp_replace(regexp_replace(coalesce(q, ''), '[^A-Za-z0-9 ]+', ' ', 'g'), '\s+', ' ', 'g'))) as t
  ), w as (
    select s.t, string_to_array(s.t, ' ') as words from s where char_length(s.t) >= 2
  ), cand as (
    select c.*, w.t
    from public.colleges c, w
    where (c.search_text like '%' || w.words[1] || '%' or w.t = any (c.aliases))
      and not exists (select 1 from unnest(w.words) x where c.search_text not like '%' || x || '%')
    order by (w.t = any (c.aliases)) desc, c.featured desc, char_length(c.name)
    limit 200
  )
  select c.id, c.name, c.city, c.state, c.kind,
         (select count(*) from public.profiles p where p.college_id = c.id)::int as students
  from cand c
  order by (c.t = any (c.aliases)) desc,
           c.featured desc,
           students desc,
           (lower(c.name) like c.t || '%') desc,
           case c.kind when 'university' then 0 when 'college' then 1 when 'standalone' then 2 else 3 end,
           char_length(c.name)
  limit greatest(1, least(coalesce(lim, 10), 30));
$$;

-- Colleges that already have students on Den (for suggestions and for showing college names in the app).
create or replace function public.active_colleges()
returns table (id text, name text, city text, state text, students int)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.city, c.state, count(p.id)::int
  from public.colleges c join public.profiles p on p.college_id = c.id
  group by c.id
  order by count(p.id) desc, c.name
  limit 2000;
$$;

revoke all on function public.search_colleges(text, int) from public;
revoke all on function public.active_colleges() from public;
grant execute on function public.search_colleges(text, int) to anon, authenticated;
grant execute on function public.active_colleges() to anon, authenticated;

-- 3. Admin: import the AISHE list --------------------------------------------------------
-- rows: [[aishe_code, name, district, state, kind, aliases[], featured(0/1)], ...]
-- A college a student already added with the same name is upgraded in place (students stay put).
create or replace function public.admin_import_colleges(rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare added int := 0; updated int := 0; matched int := 0;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;

  create temp table _imp on commit drop as
  select r->>0 as code, left(r->>1, 200) as name, left(coalesce(r->>2, ''), 60) as city, left(coalesce(r->>3, ''), 60) as state,
         r->>4 as kind,
         coalesce((select array_agg(lower(a)) from jsonb_array_elements_text(r->5) a), '{}') as aliases,
         coalesce((r->>6)::int, 0) = 1 as featured,
         regexp_replace(lower(r->>1), '[^a-z0-9]+', '', 'g') as key
  from jsonb_array_elements(rows) r
  where r->>4 in ('university','college','standalone') and char_length(r->>1) >= 2;

  update public.colleges c set name = i.name, city = i.city, state = i.state, kind = i.kind, aliases = i.aliases, featured = i.featured, reviewed = true
  from _imp i where c.aishe_code = i.code;
  get diagnostics updated = row_count;

  -- Den's starter colleges whose short names don't match AISHE's names.
  with known(id, code) as (values
    ('bits-goa','C-61982'), ('bits-hyderabad','C-55231'), ('cusat','U-0253'), ('iiit-bangalore','U-0221'), ('iiit-hyderabad','U-0014'),
    ('iit-bhu','U-0701'), ('jntuh','U-0017'), ('kiit','U-0356'), ('nit-surathkal','U-0237'), ('pes','U-0733'), ('thapar','U-0385'),
    ('vit-chennai','C-49441'), ('vit-vellore','U-0490'), ('vjti','C-33641'))
  update public.colleges c set aishe_code = i.code, name = i.name, city = case when c.city = '' then i.city else c.city end,
         state = i.state, kind = i.kind, aliases = (select array(select distinct unnest(i.aliases || lower(c.name)))), featured = i.featured, reviewed = true
  from known k join _imp i on i.code = k.code
  where c.id = k.id and c.aishe_code is null and not exists (select 1 from public.colleges x where x.aishe_code = i.code);

  -- A college already on Den with the same name or a known short name ("IIT Bombay") becomes the AISHE college,
  -- so its students and posts stay where they are.
  with m as (
    select distinct on (c.id) c.id, i.code, i.name, i.city, i.state, i.kind, i.aliases, i.featured
    from _imp i join public.colleges c
      on c.aishe_code is null and (c.name_key = i.key or lower(c.name) = any (i.aliases))
    where not exists (select 1 from public.colleges x where x.aishe_code = i.code)
    order by c.id, (c.name_key = i.key) desc, i.featured desc, case i.kind when 'university' then 0 else 1 end, i.code
  ), one as (select distinct on (code) * from m order by code, id)
  update public.colleges c set aishe_code = one.code, name = one.name, city = case when c.city = '' then one.city else c.city end,
         state = one.state, kind = one.kind, aliases = (select array(select distinct unnest(one.aliases || lower(c.name)))), featured = one.featured, reviewed = true
  from one where c.id = one.id;
  get diagnostics matched = row_count;

  insert into public.colleges (id, name, city, state, kind, aliases, featured, reviewed, aishe_code)
  select 'aishe-' || lower(i.code), i.name, i.city, i.state, i.kind, i.aliases, i.featured, true, i.code
  from _imp i
  where not exists (select 1 from public.colleges x where x.aishe_code = i.code)
  on conflict do nothing;
  get diagnostics added = row_count;

  return jsonb_build_object('added', added, 'updated', updated, 'matched', matched);
end $$;

-- 4. Admin: review colleges students added -----------------------------------------------
create or replace function public.admin_student_colleges()
returns table (id text, name text, city text, created_at timestamptz, students int, suggestions jsonb)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.name, c.city, c.created_at,
         (select count(*) from public.profiles p where p.college_id = c.id)::int,
         (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'city', s.city, 'state', s.state)), '[]'::jsonb)
            from (select x.id, x.name, x.city, x.state from public.colleges x
                  where x.aishe_code is not null and x.search_text % lower(c.name)
                  order by similarity(x.search_text, lower(c.name)) desc limit 3) s)
  from public.colleges c
  where public.is_admin() and c.kind = 'student' and not c.reviewed
  order by c.created_at desc
  limit 200;
$$;

create or replace function public.admin_mark_college(college text, ok boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  update public.colleges set reviewed = ok where id = college;
  insert into public.admin_actions (admin_id, action, note)
  values (auth.uid(), 'college_reviewed', college || case when ok then ' looks right' else ' needs another look' end);
end $$;

-- Move everything from one college to another (a duplicate or misspelt college), then remove the old one.
create or replace function public.admin_merge_college(from_id text, into_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t record; moved int := 0; n int;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if from_id = into_id then raise exception 'Pick a different college to merge into.'; end if;
  if not exists (select 1 from public.colleges where id = into_id) then raise exception 'That college does not exist.'; end if;
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'college_id'
  loop
    execute format('update public.%I set college_id = $1 where college_id = $2', t.table_name) using into_id, from_id;
    get diagnostics n = row_count; moved := moved + n;
  end loop;
  update public.colleges i set email_domains = (select array(select distinct unnest(i.email_domains || f.email_domains)))
  from public.colleges f where i.id = into_id and f.id = from_id;
  delete from public.colleges where id = from_id;
  insert into public.admin_actions (admin_id, action, note)
  values (auth.uid(), 'college_merged', from_id || ' merged into ' || into_id || ' (' || moved || ' rows moved)');
  return jsonb_build_object('moved', moved);
end $$;

create or replace function public.admin_college_counts()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then jsonb_build_object(
    'total', (select count(*) from public.colleges),
    'aishe', (select count(*) from public.colleges where aishe_code is not null),
    'to_review', (select count(*) from public.colleges where kind = 'student' and not reviewed),
    'with_students', (select count(distinct college_id) from public.profiles)
  ) end;
$$;

revoke all on function public.admin_import_colleges(jsonb) from public, anon;
revoke all on function public.admin_student_colleges() from public, anon;
revoke all on function public.admin_mark_college(text, boolean) from public, anon;
revoke all on function public.admin_merge_college(text, text) from public, anon;
revoke all on function public.admin_college_counts() from public, anon;
grant execute on function public.admin_import_colleges(jsonb) to authenticated;
grant execute on function public.admin_student_colleges() to authenticated;
grant execute on function public.admin_mark_college(text, boolean) to authenticated;
grant execute on function public.admin_merge_college(text, text) to authenticated;
grant execute on function public.admin_college_counts() to authenticated;
