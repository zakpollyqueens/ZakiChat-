-- 051: Do not allow future-dated upgrades to unlock a customized mode.
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
      and u.starts_at <= now()
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
      and u.starts_at <= now()
      and u.expires_at > now()
  ) then
    raise exception 'An active Customized Business subscription is required for this mode.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_zakichat_account_mode() from public, anon, authenticated;
