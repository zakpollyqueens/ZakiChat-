create or replace function public.get_profile_visibility(p_profile_owner_id uuid)
returns table(profile_visible boolean, profile_photo_visible boolean, about_visible boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    case coalesce(ps.profile_visibility, 'everyone')
      when 'nobody' then false
      when 'contacts' then exists (
        select 1 from public.contacts c
        where c.user_id = p_profile_owner_id
          and c.contact_user_id = (select auth.uid())
      )
      else true
    end as profile_visible,
    case coalesce(ps.profile_photo_visibility, 'everyone')
      when 'nobody' then false
      when 'contacts' then exists (
        select 1 from public.contacts c
        where c.user_id = p_profile_owner_id
          and c.contact_user_id = (select auth.uid())
      )
      else true
    end as profile_photo_visible,
    case coalesce(ps.about_visibility, 'contacts')
      when 'nobody' then false
      when 'contacts' then exists (
        select 1 from public.contacts c
        where c.user_id = p_profile_owner_id
          and c.contact_user_id = (select auth.uid())
      )
      else true
    end as about_visible
  from (select (select auth.uid()) as viewer_id) viewer
  left join public.privacy_settings ps on ps.user_id = p_profile_owner_id
  where viewer.viewer_id is not null;
$$;

revoke all on function public.get_profile_visibility(uuid) from public, anon;
grant execute on function public.get_profile_visibility(uuid) to authenticated;
