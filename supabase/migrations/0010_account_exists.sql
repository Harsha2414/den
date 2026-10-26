-- Den: lets the Sign up page say "This email already has a Den account. Sign in instead."
-- Run this once in the Supabase SQL Editor after 0009. Safe to run again.
-- Only answers yes/no for a finished Den account (signed up and created a profile); it reveals nothing else.

create or replace function public.email_has_account(p_email text)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from auth.users u join public.profiles p on p.id = u.id
    where lower(u.email) = lower(btrim(p_email))
  );
$$;
revoke all on function public.email_has_account(text) from public;
grant execute on function public.email_has_account(text) to anon, authenticated;
