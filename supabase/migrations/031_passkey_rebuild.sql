-- ============================================================
-- ZAKICHAT PASSKEY REBUILD
-- Fresh passkey tables and policies.
-- Existing WebAuthn secrets/configuration are NOT changed.
-- 2FA tables from migration 029 remain untouched.
-- ============================================================

drop table if exists public.passkey_challenges cascade;
drop table if exists public.passkeys cascade;

create table public.passkeys (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

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

create index passkeys_user_id_idx
on public.passkeys(user_id);

create index passkeys_created_at_idx
on public.passkeys(created_at desc);

alter table public.passkeys
enable row level security;

create policy "Users can view their own passkeys"
on public.passkeys
for select
to authenticated
using (
  auth.uid() = user_id
);

create policy "Users can delete their own passkeys"
on public.passkeys
for delete
to authenticated
using (
  auth.uid() = user_id
);


create table public.passkey_challenges (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  challenge text not null,

  challenge_type text not null
    check (
      challenge_type in (
        'registration',
        'authentication'
      )
    ),

  expires_at timestamptz not null,

  created_at timestamptz not null default now()
);

create index passkey_challenges_user_idx
on public.passkey_challenges(
  user_id,
  challenge_type,
  expires_at
);

alter table public.passkey_challenges
enable row level security;


-- Only the server-side security-auth function should
-- manipulate challenge records. No browser policy is
-- created for these records.


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
