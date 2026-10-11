-- 050: Persist the user's selected ZakiChat experience mode separately from login identity.
-- Mode selection never grants subscription entitlements; active subscriptions remain authoritative.

create table if not exists public.user_account_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_mode text not null default 'local'
    check (account_mode in ('local', 'personal_customized', 'business_customized')),
  updated_at timestamptz not null default now()
);

alter table public.user_account_preferences enable row level security;

drop policy if exists user_account_preferences_select_own on public.user_account_preferences;
create policy user_account_preferences_select_own
on public.user_account_preferences for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists user_account_preferences_insert_own on public.user_account_preferences;
create policy user_account_preferences_insert_own
on public.user_account_preferences for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists user_account_preferences_update_own on public.user_account_preferences;
create policy user_account_preferences_update_own
on public.user_account_preferences for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function public.validate_zakichat_account_mode()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();

  if new.account_mode = 'personal_customized' and not exists (
    select 1 from public.user_upgrades u
    where u.user_id = new.user_id
      and u.plan = 'personal_monthly'
      and u.status = 'active'
      and u.expires_at > now()
  ) then
    raise exception 'An active Customized Personal subscription is required for this mode.'
      using errcode = '42501';
  end if;

  if new.account_mode = 'business_customized' and not exists (
    select 1 from public.user_upgrades u
    where u.user_id = new.user_id
      and u.plan = 'business_monthly'
      and u.status = 'active'
      and u.expires_at > now()
  ) then
    raise exception 'An active Customized Business subscription is required for this mode.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_zakichat_account_mode on public.user_account_preferences;
create trigger validate_zakichat_account_mode
before insert or update of account_mode, user_id
on public.user_account_preferences
for each row execute function public.validate_zakichat_account_mode();

revoke all on function public.validate_zakichat_account_mode() from public, anon, authenticated;
grant select, insert, update on public.user_account_preferences to authenticated;

comment on table public.user_account_preferences is
'Stores the preferred Local, Customized Personal, or Customized Business UI mode. Subscription entitlements are checked separately.';
