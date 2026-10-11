-- Server-only, short-lived login challenges. No client role may read session tokens.
create table if not exists public.email_login_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  encrypted_session text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_login_challenges_expiry_idx
  on public.email_login_challenges (expires_at);
alter table public.email_login_challenges enable row level security;
revoke all on table public.email_login_challenges from anon, authenticated;
grant all on table public.email_login_challenges to service_role;
