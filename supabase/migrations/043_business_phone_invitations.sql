-- Phone-based invitations match ZakiChat's phone-first authentication.
alter table public.business_members add column if not exists phone text;
alter table public.business_members alter column email drop not null;
create unique index if not exists business_members_business_phone_unique
  on public.business_members (business_id, phone) where phone is not null;
create index if not exists business_members_business_invites_idx
  on public.business_members (business_id, status, created_at desc);
