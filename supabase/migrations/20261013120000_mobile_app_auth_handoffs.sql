create table if not exists public.mobile_app_auth_handoffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mobile_app_auth_handoffs_expiry_idx
  on public.mobile_app_auth_handoffs (expires_at);
alter table public.mobile_app_auth_handoffs enable row level security;
revoke all on table public.mobile_app_auth_handoffs from anon, authenticated;
grant all on table public.mobile_app_auth_handoffs to service_role;
