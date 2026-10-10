-- ZakiChat release management: private binary storage and published release metadata.
create table if not exists public.app_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  title text not null,
  description text not null,
  channel text not null default 'stable'
    check (channel in ('stable', 'beta', 'testing')),
  release_notes text not null default '',
  download_path text not null,
  download_file_name text not null,
  download_content_type text,
  download_size_bytes bigint
    check (download_size_bytes is null or download_size_bytes between 1 and 104857600),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (version, channel)
);

create index if not exists app_releases_status_published_idx
  on public.app_releases(status, published_at desc);

create index if not exists app_releases_created_at_idx
  on public.app_releases(created_at desc);

alter table public.app_releases enable row level security;
revoke all on public.app_releases from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'app-releases',
  'app-releases',
  false,
  104857600,
  array[
    'application/vnd.android.package-archive',
    'application/vnd.google.android.package-archive',
    'application/octet-stream',
    'application/zip',
    'application/x-zip-compressed'
  ]::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = 104857600,
    allowed_mime_types = excluded.allowed_mime_types;
