-- Den: names must look like names (no digits, symbols or emoji). Letters from any language are fine
-- (Harsha, हर्ष, ஹர்ஷா), plus spaces, dots, apostrophes and hyphens (D. Ravi, O'Brien, Ravi-Kumar).
-- Run this once in the Supabase SQL Editor after 0008. Safe to run again. Existing profiles are not checked
-- (NOT VALID), only new and edited ones; fix or remove odd old ones from Den Admin → Students.

create or replace function public.looks_like_name(n text)
returns boolean language sql immutable as $$
  select n is not null
    and char_length(btrim(n)) between 2 and 61
    -- no digits, no symbols other than . ' ’ -
    and n !~ '[0-9!@#$%^&*()_+=\[\]{}<>?/\\|~`";:,¡-¿×÷]'
    -- no emoji or pictographs
    and n !~ '[\U0001F000-\U0001FAFF☀-➿️‍]'
    -- at least two letters (anything that isn't a space or . ' ’ -)
    and char_length(regexp_replace(n, '[[:space:].''’-]', '', 'g')) >= 2
    -- not just punctuation repeated
    and n !~ '[.''’-]{3,}';
$$;

alter table public.profiles drop constraint if exists profiles_name_looks_real;
alter table public.profiles add constraint profiles_name_looks_real check (public.looks_like_name(name)) not valid;
