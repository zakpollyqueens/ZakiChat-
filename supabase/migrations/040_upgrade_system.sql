-- ============================================================
-- ZAKICHAT UPGRADE & SUBSCRIPTION SYSTEM
-- Migration 040
-- ============================================================

-- ------------------------------------------------------------
-- 1. User upgrade/subscription state
-- ------------------------------------------------------------

create table if not exists public.user_upgrades (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  plan text not null
    check (
      plan in (
        'personal_monthly',
        'business_monthly'
      )
    ),

  price_usd numeric(10,2) not null
    check (price_usd >= 0),

  currency text not null default 'USD',

  status text not null default 'active'
    check (
      status in (
        'active',
        'expired',
        'cancelled'
      )
    ),

  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,

  source text not null default 'automatic'
    check (
      source in (
        'automatic',
        'manual'
      )
    ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_upgrades_user_id_idx
on public.user_upgrades(user_id);

create index if not exists user_upgrades_status_idx
on public.user_upgrades(status);

create index if not exists user_upgrades_expires_at_idx
on public.user_upgrades(expires_at);

create index if not exists user_upgrades_plan_idx
on public.user_upgrades(plan);


-- ------------------------------------------------------------
-- 2. Upgrade payment records
-- ------------------------------------------------------------

create table if not exists public.upgrade_payments (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete set null,

  upgrade_id uuid
    references public.user_upgrades(id)
    on delete set null,

  plan text not null
    check (
      plan in (
        'personal_monthly',
        'business_monthly'
      )
    ),

  amount numeric(10,2) not null
    check (amount >= 0),

  currency text not null default 'USD',

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'paid',
        'failed',
        'refunded',
        'cancelled'
      )
    ),

  payment_type text not null
    check (
      payment_type in (
        'automatic',
        'manual'
      )
    ),

  payment_method text,

  provider text,

  provider_transaction_id text,

  payment_reference text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists upgrade_payments_user_id_idx
on public.upgrade_payments(user_id);

create index if not exists upgrade_payments_upgrade_id_idx
on public.upgrade_payments(upgrade_id);

create index if not exists upgrade_payments_status_idx
on public.upgrade_payments(status);

create index if not exists upgrade_payments_payment_type_idx
on public.upgrade_payments(payment_type);

create index if not exists upgrade_payments_reference_idx
on public.upgrade_payments(payment_reference);

create unique index if not exists upgrade_payments_provider_transaction_idx
on public.upgrade_payments(provider, provider_transaction_id)
where provider_transaction_id is not null;


-- ------------------------------------------------------------
-- 3. Upgrade audit history
-- ------------------------------------------------------------

create table if not exists public.upgrade_audit_log (
  id uuid primary key default gen_random_uuid(),

  user_id uuid
    references auth.users(id)
    on delete set null,

  upgrade_id uuid
    references public.user_upgrades(id)
    on delete set null,

  payment_id uuid
    references public.upgrade_payments(id)
    on delete set null,

  actor_user_id uuid
    references auth.users(id)
    on delete set null,

  actor_type text not null
    check (
      actor_type in (
        'admin',
        'system',
        'payment_provider'
      )
    ),

  action text not null
    check (
      action in (
        'upgrade',
        'renew',
        'extend',
        'cancel',
        'expire',
        'refund',
        'reverse'
      )
    ),

  details jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists upgrade_audit_user_id_idx
on public.upgrade_audit_log(user_id);

create index if not exists upgrade_audit_upgrade_id_idx
on public.upgrade_audit_log(upgrade_id);

create index if not exists upgrade_audit_created_at_idx
on public.upgrade_audit_log(created_at desc);


-- ------------------------------------------------------------
-- 4. Plan pricing
-- ------------------------------------------------------------

create or replace function public.get_upgrade_price(
  p_plan text
)
returns numeric
language plpgsql
immutable
as $$
begin
  case p_plan
    when 'personal_monthly' then
      return 2.00;

    when 'business_monthly' then
      return 10.00;

    else
      raise exception 'Invalid ZakiChat upgrade plan.';
  end case;
end;
$$;

revoke execute on function public.get_upgrade_price(text)
from public, anon, authenticated;

grant execute on function public.get_upgrade_price(text)
to service_role;


-- ------------------------------------------------------------
-- 5. Updated-at helpers
-- ------------------------------------------------------------

create or replace function public.set_upgrade_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_upgrades_updated_at
on public.user_upgrades;

create trigger user_upgrades_updated_at
before update on public.user_upgrades
for each row
execute function public.set_upgrade_updated_at();


drop trigger if exists upgrade_payments_updated_at
on public.upgrade_payments;

create trigger upgrade_payments_updated_at
before update on public.upgrade_payments
for each row
execute function public.set_upgrade_updated_at();


-- ------------------------------------------------------------
-- 6. RLS
-- ------------------------------------------------------------

alter table public.user_upgrades enable row level security;

alter table public.upgrade_payments enable row level security;

alter table public.upgrade_audit_log enable row level security;


-- Users can see their own current/history of upgrades.
drop policy if exists "Users can view own upgrades"
on public.user_upgrades;

create policy "Users can view own upgrades"
on public.user_upgrades
for select
to authenticated
using (
  user_id = auth.uid()
);


-- Users can see their own upgrade payment records.
drop policy if exists "Users can view own upgrade payments"
on public.upgrade_payments;

create policy "Users can view own upgrade payments"
on public.upgrade_payments
for select
to authenticated
using (
  user_id = auth.uid()
);


-- Users can see their own upgrade audit entries.
drop policy if exists "Users can view own upgrade audit"
on public.upgrade_audit_log;

create policy "Users can view own upgrade audit"
on public.upgrade_audit_log
for select
to authenticated
using (
  user_id = auth.uid()
);


-- ------------------------------------------------------------
-- IMPORTANT:
--
-- There are deliberately NO normal-client INSERT, UPDATE,
-- or DELETE policies on these tables.
--
-- Paid access must only be granted by trusted server-side
-- administrator/payment-provider logic.
-- ------------------------------------------------------------

comment on table public.user_upgrades is
'Current and historical ZakiChat Personal/Business upgrade subscriptions.';

comment on table public.upgrade_payments is
'Payment transactions associated with ZakiChat upgrades. Separate from registration_payments.';

comment on table public.upgrade_audit_log is
'Immutable-style audit history for administrator, system and payment-provider upgrade actions.';

comment on function public.get_upgrade_price is
'Returns official ZakiChat monthly upgrade price: Personal $2, Business $10.';
