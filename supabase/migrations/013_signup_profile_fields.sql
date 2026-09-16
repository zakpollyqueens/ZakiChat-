alter table public.profiles
  add column if not exists location text;

create index if not exists profiles_location_idx
on public.profiles(location);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    username,
    full_name,
    phone,
    location
  )
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data->>'username'), ''),
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    coalesce(
      new.raw_user_meta_data->>'phone',
      new.phone
    ),
    nullif(trim(new.raw_user_meta_data->>'location'), '')
  )
  on conflict (id) do update
  set
    username = coalesce(
      excluded.username,
      public.profiles.username
    ),
    full_name = coalesce(
      excluded.full_name,
      public.profiles.full_name
    ),
    phone = coalesce(
      excluded.phone,
      public.profiles.phone
    ),
    location = coalesce(
      excluded.location,
      public.profiles.location
    ),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created
on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();
