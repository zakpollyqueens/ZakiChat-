-- ============================================================
-- ZAKICHAT SECURITY CREDENTIALS
-- Passkeys + server-side two-step verification
-- ============================================================

create table if not exists public.passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  credential_id text not null unique,
  public_key text not null,

  counter bigint not null default 0,
  device_type text,
  backed_up boolean not null default false,
  transports text[],

  name text not null default 'Passkey',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists passkeys_user_id_idx
on public.passkeys(user_id);

alter table public.passkeys enable row level security;

drop policy if exists "Users can view their own passkeys"
on public.passkeys;

create policy "Users can view their own passkeys"
on public.passkeys
for select
to authenticated
using (auth.uid() = user_id);


create table if not exists public.passkey_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge text not null,
  challenge_type text not null
    check (challenge_type in ('registration', 'authentication')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists passkey_challenges_user_idx
on public.passkey_challenges(user_id, challenge_type, expires_at);

alter table public.passkey_challenges enable row level security;


create table if not exists public.two_step_verification (
  user_id uuid primary key references auth.users(id) on delete cascade,

  enabled boolean not null default false,

  encrypted_secret text,
  recovery_code_hashes text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz
);

alter table public.two_step_verification enable row level security;

drop policy if exists "Users can view their own two step settings"
on public.two_step_verification;

create policy "Users can view their own two step settings"
on public.two_step_verification
for select
to authenticated
using (auth.uid() = user_id);


create table if not exists public.two_step_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  challenge text not null,
  expires_at timestamptz not null,

  created_at timestamptz not null default now()
);

create index if not exists two_step_challenges_user_idx
on public.two_step_challenges(user_id, expires_at);

alter table public.two_step_challenges enable row level security;


-- Keep old challenges from accumulating.
create or replace function public.cleanup_security_challenges()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.passkey_challenges
  where expires_at < now();

  delete from public.two_step_challenges
  where expires_at < now();
$$;
