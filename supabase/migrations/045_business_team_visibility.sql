-- Let active workspace members see the roster for their own workspace only.
drop policy if exists business_members_select_owner_or_self_or_invitee on public.business_members;
create policy business_members_select_owner_or_self_or_invitee on public.business_members
for select to authenticated using (
  private.is_business_member(business_id)
  or (status = 'invited' and lower(email) = lower(coalesce((select auth.jwt())->>'email','')))
);
