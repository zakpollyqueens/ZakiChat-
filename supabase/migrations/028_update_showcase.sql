-- ============================================================
-- ZAKICHAT UPDATE SHOWCASE
-- Promotional/feature images displayed in Updates.
-- Admin publishing will be connected through the Admin system.
-- ============================================================

create table if not exists public.update_showcase_items (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  description text,
  category text not null default 'Feature',

  image_url text not null,
  target_url text,

  sort_order integer not null default 0,

  is_published boolean not null default false,

  starts_at timestamptz,
  ends_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists update_showcase_published_idx
on public.update_showcase_items (is_published, sort_order);

create index if not exists update_showcase_dates_idx
on public.update_showcase_items (starts_at, ends_at);

alter table public.update_showcase_items enable row level security;

drop policy if exists "Authenticated users can view published showcase items"
on public.update_showcase_items;

create policy "Authenticated users can view published showcase items"
on public.update_showcase_items
for select
to authenticated
using (
  is_published = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

-- Promotional showcase images.
-- The bucket is public because these are intentionally public
-- promotional assets. Upload/update/delete authority will later
-- be handled by the secure Admin backend/service role.
insert into storage.buckets (id, name, public)
values ('update-showcase', 'update-showcase', true)
on conflict (id) do update
set public = true;

drop policy if exists "Public can view ZakiChat showcase assets"
on storage.objects;

create policy "Public can view ZakiChat showcase assets"
on storage.objects
for select
to public
using (bucket_id = 'update-showcase');
