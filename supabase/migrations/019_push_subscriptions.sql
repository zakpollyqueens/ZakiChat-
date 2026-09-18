-- ZakiChat Phase 6.7
-- Web Push subscription storage.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  endpoint text not null,
  p256dh text not null,
  auth text not null,

  user_agent text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint push_subscriptions_user_endpoint_unique
    unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_id_idx
on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users can view their push subscriptions"
on public.push_subscriptions;

create policy "Users can view their push subscriptions"
on public.push_subscriptions
for select
to authenticated
using (
  user_id = auth.uid()
);

drop policy if exists "Users can create their push subscriptions"
on public.push_subscriptions;

create policy "Users can create their push subscriptions"
on public.push_subscriptions
for insert
to authenticated
with check (
  user_id = auth.uid()
);

drop policy if exists "Users can update their push subscriptions"
on public.push_subscriptions;

create policy "Users can update their push subscriptions"
on public.push_subscriptions
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

drop policy if exists "Users can delete their push subscriptions"
on public.push_subscriptions;

create policy "Users can delete their push subscriptions"
on public.push_subscriptions
for delete
to authenticated
using (
  user_id = auth.uid()
);

create or replace function public.set_push_subscription_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists push_subscriptions_updated_at
on public.push_subscriptions;

create trigger push_subscriptions_updated_at
before update on public.push_subscriptions
for each row
execute function public.set_push_subscription_updated_at();

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'push_subscriptions'
    ) then

      alter publication supabase_realtime
      add table public.push_subscriptions;

    end if;

  end if;
end;
$$;
