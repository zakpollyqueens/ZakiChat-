-- Account-owned business workspace, available only while Customized Business is active.
create table if not exists public.molan_business_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null default '{"name":"","category":"","phone":"","email":"","address":"","description":""}'::jsonb,
  products jsonb not null default '[]'::jsonb,
  customers jsonb not null default '[]'::jsonb,
  orders jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint molan_business_profile_object check (jsonb_typeof(profile) = 'object'),
  constraint molan_business_products_array check (jsonb_typeof(products) = 'array'),
  constraint molan_business_customers_array check (jsonb_typeof(customers) = 'array'),
  constraint molan_business_orders_array check (jsonb_typeof(orders) = 'array')
);

alter table public.molan_business_workspaces enable row level security;

drop policy if exists "Customized business members read own workspace" on public.molan_business_workspaces;
create policy "Customized business members read own workspace"
  on public.molan_business_workspaces for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.user_upgrades u
      where u.user_id = (select auth.uid())
        and u.plan in ('business_monthly','business_customized')
        and u.status = 'active'
        and u.expires_at > now()
    )
  );

drop policy if exists "Customized business members create own workspace" on public.molan_business_workspaces;
create policy "Customized business members create own workspace"
  on public.molan_business_workspaces for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.user_upgrades u
      where u.user_id = (select auth.uid())
        and u.plan in ('business_monthly','business_customized')
        and u.status = 'active'
        and u.expires_at > now()
    )
  );

drop policy if exists "Customized business members update own workspace" on public.molan_business_workspaces;
create policy "Customized business members update own workspace"
  on public.molan_business_workspaces for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.user_upgrades u
      where u.user_id = (select auth.uid())
        and u.plan in ('business_monthly','business_customized')
        and u.status = 'active'
        and u.expires_at > now()
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.user_upgrades u
      where u.user_id = (select auth.uid())
        and u.plan in ('business_monthly','business_customized')
        and u.status = 'active'
        and u.expires_at > now()
    )
  );

create or replace function public.touch_molan_business_workspace_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists molan_business_workspace_updated_at on public.molan_business_workspaces;
create trigger molan_business_workspace_updated_at
before update on public.molan_business_workspaces
for each row execute function public.touch_molan_business_workspace_updated_at();
