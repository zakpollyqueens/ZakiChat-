alter table public.privacy_settings
  add column if not exists profile_visibility text not null default 'everyone';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.privacy_settings'::regclass
      and conname = 'privacy_settings_profile_visibility_check'
  ) then
    alter table public.privacy_settings
      add constraint privacy_settings_profile_visibility_check
      check (profile_visibility in ('everyone', 'contacts', 'nobody'));
  end if;
end
$$;
