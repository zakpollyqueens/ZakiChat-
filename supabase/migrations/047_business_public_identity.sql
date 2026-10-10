-- Preserve the personal profile when a user switches their public identity to a business.
alter table public.business_workspaces
  add column if not exists personal_profile_name text,
  add column if not exists personal_profile_avatar_url text,
  add column if not exists personal_profile_bio text,
  add column if not exists business_identity_enabled boolean not null default false;
