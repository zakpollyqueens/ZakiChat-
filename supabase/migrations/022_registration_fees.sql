-- ============================================================
-- ZakiChat Registration Fees
-- Migration 022
-- ============================================================

create table if not exists public.registration_payments (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references auth.users(id) on delete set null,

  phone text not null,
  country_code text not null,
  country_name text,

  fee_usd numeric(10,2) not null default 0,
  currency text not null default 'USD',

  status text not null default 'pending'
    check (status in (
      'pending',
      'paid',
      'failed',
      'cancelled'
    )),

  provider text,
  order_id text unique,
  payment_reference text,

  checkout_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------

create index if not exists idx_registration_payments_user_id
  on public.registration_payments(user_id);

create index if not exists idx_registration_payments_phone
  on public.registration_payments(phone);

create index if not exists idx_registration_payments_status
  on public.registration_payments(status);

create index if not exists idx_registration_payments_order_id
  on public.registration_payments(order_id);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

alter table public.registration_payments enable row level security;

-- Users may view their own registration-payment records.
drop policy if exists "Users can view own registration payments"
on public.registration_payments;

create policy "Users can view own registration payments"
on public.registration_payments
for select
to authenticated
using (user_id = auth.uid());

-- No client INSERT/UPDATE/DELETE policies are intentionally created.
-- Payment records must be created/updated by trusted server-side logic.

-- ------------------------------------------------------------
-- Updated timestamp
-- ------------------------------------------------------------

create or replace function public.set_registration_payment_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists registration_payments_updated_at
on public.registration_payments;

create trigger registration_payments_updated_at
before update on public.registration_payments
for each row
execute function public.set_registration_payment_updated_at();

-- ------------------------------------------------------------
-- Registration fee calculation
--
-- Uganda (+256), Kenya (+254), Tanzania (+255) = FREE
-- Other African countries = $1
-- Outside Africa = $5
--
-- This function accepts a server-determined country code.
-- It is not intended to trust a browser-supplied fee.
-- ------------------------------------------------------------

create or replace function public.get_registration_fee(
  p_country_code text,
  p_is_african boolean
)
returns numeric
language plpgsql
immutable
as $$
begin
  if upper(trim(p_country_code)) in ('UG', 'KE', 'TZ') then
    return 0.00;
  end if;

  if p_is_african then
    return 1.00;
  end if;

  return 5.00;
end;
$$;

comment on table public.registration_payments is
'Tracks one-time ZakiChat registration fees and payment-provider references.';

comment on function public.get_registration_fee is
'Returns ZakiChat registration fee: UG/KE/TZ free, other Africa $1, outside Africa $5.';

-- Never allow normal clients to call the fee calculator directly.
revoke execute on function public.get_registration_fee(text, boolean)
from public, anon, authenticated;

grant execute on function public.get_registration_fee(text, boolean)
to service_role;
