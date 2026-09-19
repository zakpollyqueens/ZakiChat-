-- ============================================================
-- ZAKICHAT PASSKEY MANAGEMENT
-- Allow authenticated users to remove their own passkeys.
-- ============================================================

alter table public.passkeys
enable row level security;

drop policy if exists "Users can delete their own passkeys"
on public.passkeys;

create policy "Users can delete their own passkeys"
on public.passkeys
for delete
to authenticated
using (auth.uid() = user_id);
